import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// ======= 禁止 barrel 自引用规则 =======
// 对外桶、对内直、禁自引、CI 强检
// 注意：ESLint flat config 的 RuleLevelAndOptions 类型要求 tuple 精确推断，
// 但 vue-tsc 编译 eslint.config.ts 时无法正确推断 ['error', {...}] 为元组而非数组
// 所以用 any[] 跳过类型检查，ESLint 运行时完全合法
const selfBarrelRules: any[] = [
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
  {
    files: ['src/components/features/step/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/components/features/step', message: '禁自引' }],
      }],
    },
  },
  {
    files: ['src/components/features/quiz/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/components/features/quiz', message: '禁自引' }],
      }],
    },
  },
  {
    files: ['src/components/features/culture/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/components/features/culture', message: '禁自引' }],
      }],
    },
  },
  {
    files: ['src/components/features/auth/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@/components/features/auth', message: '禁自引' }],
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

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  ...selfBarrelRules,

  skipFormatting,
)
