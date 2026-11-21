import source from '../../extensions/imported-plugins/notify.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'notify.js' });
