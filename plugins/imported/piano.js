import source from '../../extensions/imported-plugins/piano.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'piano.js' });
