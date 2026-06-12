// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src');

// Resolve the `@/*` tsconfig path alias to real source files so that, with
// preserveModules, the emitted dist uses correct relative imports instead of
// leaking the unresolved `@/*` specifier (which Node cannot load).
function resolveSrcAlias() {
    return {
        name: 'resolve-src-alias',
        resolveId(source) {
            if (!source.startsWith('@/')) {
                return null;
            }
            const base = path.resolve(srcDir, source.slice(2));
            const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
            return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
        },
    };
}

export default {
    input: 'src/index.ts',
    output: [
        {
            dir: 'dist',
            format: 'esm',
            sourcemap: true,
            preserveModules: true, // Keep file structure
            preserveModulesRoot: 'src',
        },
    ],
    plugins: [
        resolveSrcAlias(),
        typescript(),
        copy({
            targets: [{src: 'src/asset/**/*', dest: 'dist/asset'}], // Copy assets to dist/
        }),
    ],
    external: [
        '@playwright/test',
        '@mattermost/client',
        '@mattermost/types/config',
        '@axe-core/playwright',
        '@percy/playwright',
        'dotenv',
        'luxon',
        'node:fs/promises',
        'node:path',
        'node:fs',
        'node:os',
        'mime-types',
        'uuid',
        'async-wait-until',
        'chalk',
        'deepmerge',
    ],
};
