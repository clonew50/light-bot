import source from '../../extensions/imported-plugins/server.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'server.js' });
