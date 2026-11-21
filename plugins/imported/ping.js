import source from '../../extensions/imported-plugins/ping.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'ping.js' });
