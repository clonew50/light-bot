import source from '../../extensions/imported-plugins/test2.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'test2.js' });
