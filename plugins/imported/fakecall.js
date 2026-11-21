import source from '../../extensions/imported-plugins/fakecall.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'fakecall.js' });
