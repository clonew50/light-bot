import source from '../../extensions/imported-plugins/tesbug.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'tesbug.js' });
