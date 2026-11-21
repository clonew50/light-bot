import source from '../../extensions/imported-plugins/chess.js';
import { adaptImportedPlugin } from '../../system/imported-compat.js';

export default adaptImportedPlugin(source, { fileName: 'chess.js' });
