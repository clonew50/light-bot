import source from '../../extensions/imported-plugins/welcome.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'welcome.js' });
