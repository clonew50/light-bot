import source from '../../extensions/imported-plugins/internet-fetch.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'internet-fetch.js' });
