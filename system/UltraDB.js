import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { writeFile, rename } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ديبانس الكتابة: أي عدد من التعديلات في نفس النافذة = كتابة واحدة على القرص
const DEBOUNCE_MS = 50;

// رسائل الأخطاء العربية الموحّدة (نفس النص القديم بالحرف — الاختبارات بتفحصه)
const errBadGroup = (id) => `❌ [DB] معرّف مجموعة غير صالح: "${String(id)}"`;
const errBadUser = (id) => `❌ [DB] معرّف مستخدم غير صالح: "${String(id)}"`;
const errRootGroup = '❌ [DB] ممنوع استبدال جذر "groups" — استخدم db.groups[المعرّف] = {...}';
const errRootUser = '❌ [DB] ممنوع استبدال جذر "users" — استخدم db.users[المعرّف] = {...}';

// خصائص داخلية في JS بيتسأل عنها الـ proxy (toJSON / inspect / constructor...):
// دي مش محاولات قراءة سجل، فمن نرميش عليها الخطأ العربي
const JS_INTERNAL = new Set([
    'constructor', 'prototype', 'then', 'toJSON', 'inspect', 'toString', 'valueOf',
    'hasOwnProperty', 'length', 'name', 'nodeType', 'tagName', '$$typeof',
    'asymmetricMatch', '@@__IMMUTABLE_ITERABLE__@@'
]);

class UltraDB {
    #path;
    #saveTimer = null;
    #exitHooked = false;
    #dirty = false;          // فيه تعديل مش متكتب على القرص
    #writing = null;         // الكتابة غير المتزامنة الشغالة دلوقتي (Promise)
    #lastWritten = null;     // آخر JSON اتكتب فعلًا — عشان منكتبش نفس المحتوى مرتين
    #writeCount = 0;
    #proxies = new WeakMap(); // كاش البروكسيات: نفس الكائن = نفس البروكسي (هوية ثابتة)
    #dataWasMissing = false;  // الجذر `data` مكانش موجود في الملف القديم

    constructor() {
        // التستات والسكربتات بتقدر توجّه الداتابيز لمسار مؤقت من غير ما تلمس
        // إعدادات الإنتاج (المسار الافتراضي زي ما هو: system/database.json)
        const override = process.env.LIGHTBOT_DB_FILE;
        this.#path = override ? path.resolve(override) : path.join(__dirname, 'database.json');

        const dir = path.dirname(this.#path);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        this.data = this.#load();

        // أول تشغيل على داتابيز قديمة: نثبّت الجذر `data` خالص (كان بيتخلق في
        // الذاكرة بس ويتوه مع أول إخراج). كتابة واحدة بس، وبعدها الديبانس الطبيعي.
        if (this.#dataWasMissing) this.#save();

        // فلاش أخير عند خروج العملية: أي حفظ معلّق (ديبانس 50ms) يتم قبل ما نخرج
        if (!this.#exitHooked) {
            this.#exitHooked = true;
            process.on('exit', () => {
                if (!this.#saveTimer && !this.#dirty && !this.#writing) return;
                this.flush();
            });
        }

        return this.#createProxy();
    }

    /** مسار ملف الداتابيز (للتشخيص والاختبارات). */
    get file() { return this.#path; }
    /** عدد الكتابات الفعلية على القرص — الاختبارات بتستخدمه تثبت "مفيش كتابة بلا تغيير". */
    get writeCount() { return this.#writeCount; }

    #load() {
        try {
            if (existsSync(this.#path)) {
                const raw = readFileSync(this.#path, 'utf-8');
                if (raw.trim()) {
                    const parsed = JSON.parse(raw);
                    if (!parsed.groups) parsed.groups = {};
                    if (!parsed.users) parsed.users = {};
                    if (parsed.dev === undefined) parsed.dev = false;
                    // الجذر `data` لازم يكون كائن حقيقي: كل إ award للـXP وكل إعدادات
                    // الوكيل بتقرا منه. قبل كده كان `undefined` فبتضيع كل الكتابات.
                    if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
                        parsed.data = {};
                        this.#dataWasMissing = true;
                    }
                    if (!parsed.data.users || typeof parsed.data.users !== 'object') {
                        parsed.data.users = {};
                        this.#dataWasMissing = true;
                    }
                    return parsed;
                }
            }
        } catch (e) {
            console.error('⚠️ [DB] ملف الداتابيز تالف — نبدأ من جديد:', e.message);
        }
        this.#dataWasMissing = true;
        return { groups: {}, users: {}, dev: false, data: { users: {} } };
    }

    /**
     * كتابة ذرية (tmp ثم rename) — متزامنة، بس بتتنده من `flush()` بس (الإشارات
     * والخروج)، مش من كل رسالة. كتابة الديبانس بتروح للمسار غير المتزامن.
     */
    #writeNow() {
        const payload = JSON.stringify(this.data, null, 2);
        if (payload === this.#lastWritten && this.#writeCount > 0) return false;
        const tmp = `${this.#path}.tmp-${process.pid}-${Date.now()}`;
        writeFileSync(tmp, payload);
        renameSync(tmp, this.#path);
        this.#lastWritten = payload;
        this.#dirty = false;
        this.#writeCount += 1;
        return true;
    }

    /**
     * flush() — يكتب أي حفظ معلّق فورًا بدل ما نستنى الديبانس.
     * بتتستخدم عند إشارات الإيقاف (SIGTERM / SIGINT) عشان آخر كتابة
     * في الداتابيز ما تضيعش (GAP-18).
     * @returns {boolean} هل الكتابة نجحت
     */
    flush() {
        if (this.#saveTimer) {
            clearTimeout(this.#saveTimer);
            this.#saveTimer = null;
        }
        try {
            if (!this.#dirty && !this.#writing) return this.#writeCount > 0;
            this.#writeNow();
            // لو فيه كتابة غير متزامنة شغالة: بنعيد كتابة أحدث حالة بعد ما تخلص
            // (القديمة ممكن تعمل rename بعدنا وترجّع نسخة أقدم)
            if (this.#writing) {
                const payload = this.#lastWritten;
                this.#writing.then(() => {
                    if (this.#lastWritten !== payload) { try { this.#writeNow(); } catch { /* تجاهل */ } }
                }).catch(() => {});
            }
            return true;
        } catch (e) {
            console.error('⚠️ [DB] فشل حفظ الداتابيز فورًا:', e.message);
            return false;
        }
    }

    /**
     * جدولة كتابة مجمّعة: 50ms ديبانس + كتابة غير متزامنة (برّه event loop) +
     * never rewrite when nothing changed. مفيش كتابة متزامنة على كل رسالة.
     */
    #save() {
        this.#dirty = true;
        if (this.#saveTimer) return;
        this.#saveTimer = setTimeout(() => {
            this.#saveTimer = null;
            void this.#flushAsync();
        }, DEBOUNCE_MS);
        // مؤقّت غير محبوس: لو مفيش أي حاجة تانية شغالة، الـ exit hook هو اللي يفلاش
        try { this.#saveTimer?.unref?.(); } catch { /* مؤقّت مزروع */ }
    }

    async #flushAsync() {
        if (this.#writing) return;              // هيتم إعادة الاستدعاء بعد ما تخلص
        if (!this.#dirty) return;
        this.#dirty = false;
        let payload;
        try {
            payload = JSON.stringify(this.data, null, 2);
        } catch (e) {
            console.error('⚠️ [DB] فشل تسلسل الداتابيز:', e.message);
            return;
        }
        if (payload === this.#lastWritten) return;   // مفيش تغيير حقيقي — منكتبش
        const tmp = `${this.#path}.tmp-${process.pid}-${Date.now()}`;
        const expected = payload;
        this.#writing = (async () => {
            await writeFile(tmp, expected, 'utf8');
            await rename(tmp, this.#path);
            this.#lastWritten = expected;
            this.#writeCount += 1;
            this.#dirty = false;
        })()
            .catch((e) => console.error('⚠️ [DB] فشل حفظ الداتابيز:', e.message))
            .finally(() => {
                this.#writing = null;
                if (this.#dirty) { void this.#flushAsync(); return; }
                // الحالة اتغيرت أثناء الكتابة (flush متزامن) → نعيد الكتابة بآخر حالة
                const now = (() => { try { return JSON.stringify(this.data, null, 2); } catch { return null; } })();
                if (now && now !== expected) { try { this.#writeNow(); } catch { /* تجاهل */ } }
            });
    }

    #isValidId(id) {
        // واتساب بقى يبعت معرّفات @lid بدل رقم الموبايل في كذا حالة (خصوصاً
        // للمالكين ولما الحساب يكون مفعّل بالخصوصية الجديدة) — فالمعرّفValid
        // لازم يقبل @lid و@s.whatsapp.net و@g.us، ويرفض بس الحاجات اللي
        // مبقاش معرّفات أصلاً: undefined / null / [object Object] / بدون @.
        if (typeof id !== 'string') return false;
        const s = id.trim();
        if (!s || s.length > 64) return false;
        if (s === 'undefined' || s === 'null' || s === 'NaN' || s === '[object Object]') return false;
        if (s.includes('@newsletter')) return false; // معرّفات القنوات — مش مستخدمين
        if (!s.includes('@')) return false;
        return true;
    }

    /**
     * أي كائن متداخل (جوه `data` أو جوه سجل مستخدم/مجموعة) بيتغلّف ببروكسي
     * بيعلّم الداتابيز عند أي كتابة — فـ `db.data.agent.settings.x = 1` بتتحفظ
     * فعلًا، مش بتفضل في الذاكرة بس.
     */
    #wrap(value) {
        if (!value || typeof value !== 'object') return value;
        const hit = this.#proxies.get(value);
        if (hit) return hit;
        const self = this;
        const proxy = new Proxy(value, {
            get(target, prop) {
                const v = target[prop];
                if (typeof v === 'function') return v;
                if (v && typeof v === 'object') return self.#wrap(v);
                return v;
            },
            set(target, prop, val) {
                target[prop] = val;
                self.#save();
                return true;
            },
            deleteProperty(target, prop) {
                delete target[prop];
                self.#save();
                return true;
            }
        });
        this.#proxies.set(value, proxy);
        return proxy;
    }

    /**
     * سجل مستخدم/مجموعة: القراءة لوحدها ما بتعملش إدخال (نفس السلوك القديم)،
     * أول كتابة فعلية هي اللي بتثبّت السجل وبتعمل حفظ. إلغاء القيم الفلسة بتمسح
     * المفتاح (نفس دلالة الـ delete-on-falsy القديمة).
     */
    #recordProxy(box, errFactory) {
        const self = this;
        return new Proxy(box, {
            get(boxTarget, key) {
                if (key === 'exists') {
                    return (checkId) => self.#isValidId(checkId) && Object.prototype.hasOwnProperty.call(boxTarget, checkId);
                }
                // معرّف نصي شكله مستخدم بس مرفوض (مسافة، @newsletter، أطول من 64)
                // → نرمي الخطأ العربي بدل ما نرجّع undefined ونتعامل معاه كأنه غياب.
                // أسماء الخصائص الداخلية بتاعة JS (toJSON/constructor/...) بتتعدّي عادي.
                if (typeof key === 'string' && !self.#isValidId(key) && !JS_INTERNAL.has(key)) {
                    throw new Error(errFactory(key));
                }
                if (!self.#isValidId(key)) return undefined;
                const existing = boxTarget[key];
                const obj = existing || {};
                return new Proxy(obj, {
                    get(o, k) {
                        const v = o[k];
                        if (typeof v === 'function') return v;
                        if (v && typeof v === 'object') return self.#wrap(v);
                        return v;
                    },
                    set(o, k, val) {
                        // أول كتابة فعلية هي اللي بتثبّت الإدخال في الداتابيز
                        if (boxTarget[key] !== o) boxTarget[key] = o;
                        if (val === false || val === 0 || val === undefined || val === null) {
                            delete o[k];
                        } else {
                            o[k] = val;
                        }
                        if (Object.keys(o).length === 0 && boxTarget[key] === o) {
                            delete boxTarget[key];
                        }
                        self.#save();
                        return true;
                    },
                    deleteProperty(o, k) {
                        delete o[k];
                        if (Object.keys(o).length === 0 && boxTarget[key] === o) {
                            delete boxTarget[key];
                        }
                        self.#save();
                        return true;
                    }
                });
            },
            set(boxTarget, id, val) {
                if (!self.#isValidId(id)) {
                    // كنا بنرجّع false — وده TypeError في ESM strict mode.
                    // نرميه برسالة عربية واضحة بدل الفشل الصامت.
                    throw new Error(errFactory(id));
                }
                if (val && typeof val === 'object') {
                    // كائن فاضي كمان = إنشاء سجل (السابق كان بيمسح السجل!)
                    boxTarget[id] = val;
                } else {
                    delete boxTarget[id];
                }
                self.#save();
                return true;
            },
            deleteProperty(boxTarget, id) {
                delete boxTarget[id];
                self.#save();
                return true;
            }
        });
    }

    #createProxy() {
        const self = this;

        return new Proxy(this.data, {
            get(target, prop) {
                // flush() — الحفظ الفوري. لازم يتوصّل من الـ proxy لأن الـ proxy
                // بيرمي أي خاصية تانية من الـ data نفسه.
                if (prop === 'flush') {
                    return () => self.flush();
                }
                if (prop === 'file') return self.#path;
                if (prop === 'writeCount') return self.#writeCount;

                if (prop === 'groups') {
                    return self.#recordProxy(target.groups, errBadGroup);
                }

                if (prop === 'users') {
                    return self.#recordProxy(target.users, errBadUser);
                }

                if (prop === 'data') {
                    // الجذر `data` بيتخلق عند أول قراءة ويتحفظ بجد: كل كتابة
                    // تحته (db.data.users / db.data.agent.settings) بتثبت على القرص.
                    if (!target.data || typeof target.data !== 'object' || Array.isArray(target.data)) {
                        target.data = { users: {} };
                        self.#save();
                    }
                    return self.#wrap(target.data);
                }

                if (prop === 'dev') {
                    return target.dev;
                }

                if (typeof prop === 'symbol') return target[prop];

                return target[prop];
            },

            set(target, prop, val) {
                if (prop === 'groups' || prop === 'users') {
                    // إسناد الجذر نفسه كان بيرجّع false → TypeError في ESM strict.
                    throw new Error(prop === 'groups' ? errRootGroup : errRootUser);
                }
                if (prop === 'data') {
                    const next = (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};
                    if (!next.users || typeof next.users !== 'object') next.users = {};
                    target.data = next;
                    self.#save();
                    return true;
                }
                target[prop] = val;
                self.#save();
                return true;
            }
        });
    }
}

export default UltraDB;