import source from '../../extensions/imported-plugins/faketag.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'faketag.js' });
