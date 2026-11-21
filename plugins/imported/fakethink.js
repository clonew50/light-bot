import source from '../../extensions/imported-plugins/fakethink.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'fakethink.js' });
