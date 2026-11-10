'use client';

import { createContext } from 'react';

/** The project page's open tab, for blocks rendered above the tabs (the cockpit shrinks off Overview). */
export const ProjectTabContext = createContext<string>('Overview');
