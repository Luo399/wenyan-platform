import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'
import type { Linter } from 'eslint'

// ======= 禁止 barrel 自引用规则 =======
// 对外桶、对内直、禁自引、CI 强检
// 用 Linter.Config[] 给数组做上下文类型推断，这样 ['error', { ... }] 会被推断成元组，
// 不需要 as any / any[] 绕过 strict
const selfBarrelRules: Linter.Config[] = [
  {
    files: ['src/composables/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@/composables',
          message: '禁止在 @/composables 内部引用自身 barrel，请改用直接文件路径（如 @/composables/useNavigation）。',
        }],
      }],
    },
  },
  {
    files: ['src/composables/navigation/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/composables/navigation', message: '禁自引，改用 ../useNavigation' }],
      }],
    },
  },
  {
    files: ['src/composables/quiz/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/composables/quiz', message: '禁自引，改用 ../useQuizFlow' }],
      }],
    },
  },
  {
    files: ['src/composables/data/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/composables/data', message: '禁自引，改用 ../useDataLoader' }],
      }],
    },
  },
  {
    files: ['src/composables/playback/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/composables/playback', message: '禁自引' }],
      }],
    },
  },
  {
    files: ['src/composables/tracking/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/composables/tracking', message: '禁自引' }],
      }],
    },
  },
  {
    files: ['src/composables/student/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/composables/student', message: '禁自引' }],
      }],
    },
  },
]
export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  // CJS 源码（后端 / Node 脚本）里的 require 是语言特性，不是缺陷；
  // @typescript-eslint 这两条规则只对 ESM + TS 场景有意义，对 .js 只会产生噪音。
  {
    name: 'app/cjs-js',
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 测试代码大量使用松散类型构造 mock / 断言内部结构，显式 any 属常见做法；
  // 生产代码仍保持该规则为 error。
  {
    name: 'app/tests',
    files: ['tests/**/*.{ts,js}', 'backend/tests/**/*.js', 'backend/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // figma-plugin 是独立子工程（自带 tsconfig / vitest / 构建脚本），
  // 其 Figma 宿主 API 的 typings 缺口较多，any 豁免范围仅限该目录。
  {
    name: 'app/figma-plugin',
    files: ['figma-plugin/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  ...selfBarrelRules,

  skipFormatting,
)
