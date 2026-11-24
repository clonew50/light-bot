/**
 * lib/sticker.js — توافقية: addExif يستخدم writeExif من lib/exif.js
 * (البوت الجديد بيستخدم lib/exif.js بدل الملف القديم).
 */
import { writeExif } from './exif.js';

export async function addExif(buffer, packname, author) {
	const media = { mimetype: 'image/webp', data: buffer };
	return writeExif(media, { packName: packname || '', packPublish: author || '' });
}

export default addExif;