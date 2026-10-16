import React from 'react';
import type { RecordRow } from 'src/utils/controlTypes';

const ChildTableContext = React.createContext<{ rows: RecordRow[] }>({ rows: [] });
export default ChildTableContext;
