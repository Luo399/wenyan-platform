import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// ======= 禁止 barrel 自引用规则 =======
// 1. composables/ 下任何 .ts 文件 → 不得 import @/composables（顶层 barrel）
// 2. composables/<domain>/ 下任何 .ts 文件 → 不得 import @/composables/<domain>（域 barrel）
// 3. components/features/<domain>/ 下任何文件 → 不得 import @/components/features/<domain>
const selfBarrelRules = [
  // composables 内部禁引顶层 barrel
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
  // composables/<domain> 内部禁引域 barrel
  {
    files: ['src/composables/navigation/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/composables/navigation', message: '禁自引，改用 ../useNavigation' }] }] },
  },
  {
    files: ['src/composables/quiz/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/composables/quiz', message: '禁自引，改用 ../useQuizFlow' }] }] },
  },
  {
    files: ['src/composables/data/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/composables/data', message: '禁自引，改用 ../useDataLoader' }] }] },
  },
  {
    files: ['src/composables/playback/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/composables/playback', message: '禁自引，改用 ../usePlaybackControl' }] }] },
  },
  {
    files: ['src/composables/tracking/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/composables/tracking', message: '禁自引，改用 ../useTracking' }] }] },
  },
  {
    files: ['src/composables/student/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/composables/student', message: '禁自引，改用 ../useStudentInfo' }] }] },
  },
  // components/features/<domain> 内部禁引域 barrel
  {
    files: ['src/components/features/step/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/components/features/step', message: '禁自引，改用 ../../PageScaffold.vue' }] }] },
  },
  {
    files: ['src/components/features/quiz/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/components/features/quiz', message: '禁自引' }] }] },
  },
  {
    files: ['src/components/features/culture/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/components/features/culture', message: '禁自引' }] }] },
  },
  {
    files: ['src/components/features/auth/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@/components/features/auth', message: '禁自引' }] }] },
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
