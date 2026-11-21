import source from '../../extensions/imported-plugins/gemini.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'gemini.js' });
