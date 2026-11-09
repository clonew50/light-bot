import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class UltraDB {
    #path;
    #saveTimer = null;
    #exitHooked = false;
    
    constructor() {
        this.#path = path.join(__dirname, 'database.json');
        
        const dir = path.dirname(this.#path);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        
        this.data = this.#load();

        // فلاش أخير عند خروج العملية: أي حفظ معلّق (ديبانس 50ms) يتم قبل ما نخرج
        if (!this.#exitHooked) {
            this.#exitHooked = true;
            process.on('exit', () => {
                if (!this.#saveTimer) return;
                try {
                    clearTimeout(this.#saveTimer);
                    this.#saveTimer = null;
                    const tmp = `${this.#path}.tmp-final`;
                    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
                    renameSync(tmp, this.#path);
                } catch {}
            });
        }

        return this.#createProxy();
    }
    
    #load() {
        try {
            if (existsSync(this.#path)) {
                const raw = readFileSync(this.#path, 'utf-8');
                if (raw.trim()) {
                    const parsed = JSON.parse(raw);
                    if (!parsed.groups) parsed.groups = {};
                    if (!parsed.users) parsed.users = {};
                    if (parsed.dev === undefined) parsed.dev = false;
                    return parsed;
                }
            }
        } catch (e) {
            console.error('⚠️ [DB] ملف الداتابيز تالف — نبدأ من جديد:', e.message);
        }
        return { groups: {}, users: {}, dev: false };
    }
    
    #save() {
        if (this.#saveTimer) clearTimeout(this.#saveTimer);
        this.#saveTimer = setTimeout(() => {
            try {
                // كتابة ذرية: tmp ثم rename — ما بيبوظش الملف لو العملية ماتت وسط الكتابة
                const tmp = `${this.#path}.tmp-${process.pid}-${Date.now()}`;
                writeFileSync(tmp, JSON.stringify(this.data, null, 2));
                renameSync(tmp, this.#path);
            } catch (e) {
                console.error('⚠️ [DB] فشل حفظ الداتابيز:', e.message);
            }
            this.#saveTimer = null;
        }, 50);
    }
    
    #isValidId(id) {
        return id && !id.includes('@newsletter') && !id.includes('@lid') && id.includes('@');
    }
    
    #createProxy() {
        const self = this;
        
        return new Proxy(this.data, {
            get(target, prop) {
                if (prop === 'groups') {
                    return new Proxy(target.groups, {
                        get(groupTarget, groupId) {
                            if (!self.#isValidId(groupId)) return undefined;
                            // القراءة لوحدها ما تعملش إدخال جديد في الداتابيز (كان بيتلوث
                            // الملف بأدخالات فاضية من أي قراءة عادية، ومعاها حفظ لغير داعي)
                            const existing = groupTarget[groupId];
                            const obj = existing || {};
                            return new Proxy(obj, {
                                set(o, key, val) {
                                    // أول كتابة فعلية هي اللي بتثبّت الإدخال في الداتابيز
                                    if (groupTarget[groupId] !== o) groupTarget[groupId] = o;
                                    if (val === false || val === 0 || val === undefined || val === null) {
                                        delete o[key];
                                    } else {
                                        o[key] = val;
                                    }
                                    if (Object.keys(o).length === 0 && groupTarget[groupId] === o) {
                                        delete groupTarget[groupId];
                                    }
                                    self.#save();
                                    return true;
                                },
                                deleteProperty(o, key) {
                                    delete o[key];
                                    if (Object.keys(o).length === 0 && groupTarget[groupId] === o) {
                                        delete groupTarget[groupId];
                                    }
                                    self.#save();
                                    return true;
                                }
                            });
                        },
                        set(groupTarget, groupId, val) {
                            if (!self.#isValidId(groupId)) return false;
                            if (val && typeof val === 'object' && Object.keys(val).length > 0) {
                                groupTarget[groupId] = val;
                            } else {
                                delete groupTarget[groupId];
                            }
                            self.#save();
                            return true;
                        },
                        deleteProperty(groupTarget, groupId) {
                            delete groupTarget[groupId];
                            self.#save();
                            return true;
                        }
                    });
                }
                
                if (prop === 'users') {
                    return new Proxy(target.users, {
                        get(userTarget, userId) {
                            if (!self.#isValidId(userId)) return undefined;
                            // نفس فكرة الجروبات: القراءة ما بتعملش إدخال — الكتابة بس
                            const existing = userTarget[userId];
                            const obj = existing || {};
                            return new Proxy(obj, {
                                set(o, key, val) {
                                    if (userTarget[userId] !== o) userTarget[userId] = o;
                                    if (val === false || val === 0 || val === undefined || val === null) {
                                        delete o[key];
                                    } else {
                                        o[key] = val;
                                    }
                                    if (Object.keys(o).length === 0 && userTarget[userId] === o) {
                                        delete userTarget[userId];
                                    }
                                    self.#save();
                                    return true;
                                },
                                deleteProperty(o, key) {
                                    delete o[key];
                                    if (Object.keys(o).length === 0 && userTarget[userId] === o) {
                                        delete userTarget[userId];
                                    }
                                    self.#save();
                                    return true;
                                }
                            });
                        },
                        set(userTarget, userId, val) {
                            if (!self.#isValidId(userId)) return false;
                            if (val && typeof val === 'object' && Object.keys(val).length > 0) {
                                userTarget[userId] = val;
                            } else {
                                delete userTarget[userId];
                            }
                            self.#save();
                            return true;
                        },
                        deleteProperty(userTarget, userId) {
                            delete userTarget[userId];
                            self.#save();
                            return true;
                        }
                    });
                }
                
                if (prop === 'dev') {
                    return target.dev;
                }
                
                return target[prop];
            },
            
            set(target, prop, val) {
                if (prop === 'groups' || prop === 'users') {
                    return false;
                }
                target[prop] = val;
                self.#save();
                return true;
            }
        });
    }
}

export default UltraDB;