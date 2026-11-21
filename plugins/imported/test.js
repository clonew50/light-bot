import source from '../../extensions/imported-plugins/test.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'test.js' });
