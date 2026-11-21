import source from '../../extensions/imported-plugins/cmd-lock.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'cmd-lock.js' });
