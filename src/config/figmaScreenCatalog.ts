/**
 * figmaScreenCatalog - Figma 插件扫描资产的「篇目 × 角色」目录（自动生成，勿手改）
 *
 * 数据来源：生产 OSS 清单接口 GET /api/assets/oss-list 的快照，
 * 由 scripts/gen-figma-screen-catalog.mjs 折叠生成：同一篇课文在不同页面里
 * 重复上传的标题图/按钮图只保留一张，按角色名归档头像、立绘、背景。
 *
 * 快照：6049 个扫描文件 → 37 篇、775 条角色记录。
 * 重新生成：node scripts/gen-figma-screen-catalog.mjs <oss-list.json>
 *
 * 所有 path 都是相对 images/screens/ 的路径，拼接统一走 config/figmaAssets.ts。
 */

export interface FigmaScreenAssetRef {
  /** 相对 images/screens/ 的路径（含 WEN_xx/<screenType>/） */
  path: string
  /** OSS 上的字节数，用于判断是否适合直接上屏 */
  size: number
}

export type FigmaScreenRole =
  | 'btnBack'
  | 'btnNext'
  | 'btnSubmit'
  | 'btnCompleted'
  | 'bgm'
  | 'gradeArea'
  | 'videoPlaceholder'
  | 'cardBamboo'
  | 'bgScroll'
  | 'bgSummary'

export type FigmaOptionKey = 'A' | 'B' | 'C' | 'D'

export type FigmaTextBoxRole = 'summary' | 'homework' | 'proverb' | 'poem' | 'explanation'

export interface WenScreenCatalogEntry {
  /** 整篇书法标题图（页面内重复出现的取一张） */
  title?: FigmaScreenAssetRef
  roles: Partial<Record<FigmaScreenRole, FigmaScreenAssetRef>>
  options: Partial<Record<FigmaOptionKey, FigmaScreenAssetRef>>
  textBoxes: Partial<Record<FigmaTextBoxRole, FigmaScreenAssetRef>>
  /** 场景背景（单张 2.8–18MB，默认不直接渲染） */
  backgrounds: Record<string, FigmaScreenAssetRef>
  /** 角色立绘（单张 0.4–3MB，默认不直接渲染） */
  avatars: Record<string, FigmaScreenAssetRef>
  /** 角色名牌/小像（10–18KB） */
  characterCards: Record<string, FigmaScreenAssetRef>
  /** 该篇在扫描清单里的原始文件数 */
  fileCount: number
}

export const FIGMA_SCREEN_CATALOG: Record<string, WenScreenCatalogEntry> = {
  WEN_01: {
    title: { path: 'WEN_01/explanation/article_title_01_01.png', size: 29132 },
    roles: {
      btnBack: { path: 'WEN_01/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_01/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_01/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_01/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_01/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_01/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_01/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_01/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_01/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_01/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_01/quiz/option_a_01.png', size: 3794 },
      B: { path: 'WEN_01/quiz/option_b_01.png', size: 3794 },
      C: { path: 'WEN_01/quiz/option_c_01.png', size: 3809 },
      D: { path: 'WEN_01/quiz/option_d_01.png', size: 3809 },
    },
    textBoxes: {
      summary: { path: 'WEN_01/summary/summary_text_box.png', size: 651551 },
      proverb: { path: 'WEN_01/cultural_card/proverb_text_box.png', size: 542263 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_01/cultural_card/article_bg.png', size: 16757748 },
      bg_explanation: { path: 'WEN_01/explanation/bg_explanation_01.png', size: 16757748 },
      bg_field: { path: 'WEN_01/dialogue/bg_field_01.png', size: 14650920 },
      bg_rain: { path: 'WEN_01/dialogue/bg_rain_01.png', size: 17305016 },
      bg_scroll: { path: 'WEN_01/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_01/summary/bg_summary.png', size: 16757748 },
      bg_war: { path: 'WEN_01/dialogue/bg_war_01.png', size: 18606708 },
    },
    avatars: {
      avatar_Confucius: { path: 'WEN_01/dialogue/avatar_Confucius_02.png', size: 17303 },
      avatar_augur: { path: 'WEN_01/dialogue/avatar_augur_01.png', size: 2259478 },
      avatar_cao_gui: { path: 'WEN_01/dialogue/avatar_cao_gui_12.png', size: 1886154 },
      avatar_chen_sheng: { path: 'WEN_01/dialogue/avatar_chen_sheng_01.png', size: 2433656 },
      avatar_farmer: { path: 'WEN_01/dialogue/avatar_farmer_01.png', size: 1650518 },
      avatar_fighters: { path: 'WEN_01/dialogue/avatar_fighters_01.png', size: 2904041 },
      avatar_fox: { path: 'WEN_01/dialogue/avatar_fox_01.png', size: 1798987 },
      avatar_garrisonsoldier: {
        path: 'WEN_01/dialogue/avatar_garrisonsoldier_01.png',
        size: 1748475,
      },
      avatar_socialite: { path: 'WEN_01/dialogue/avatar_socialite_01.png', size: 2294268 },
      avatar_wu_guang: { path: 'WEN_01/dialogue/avatar_wu_guang_01.png', size: 2390505 },
    },
    characterCards: {
      card_character_augur: { path: 'WEN_01/dialogue/card_character_augur_01.png', size: 10665 },
      card_character_cao_gui: {
        path: 'WEN_01/dialogue/card_character_cao_gui_12.png',
        size: 12129,
      },
      card_character_chen_sheng: {
        path: 'WEN_01/dialogue/card_character_chen_sheng_01.png',
        size: 13927,
      },
      card_character_farmer: { path: 'WEN_01/dialogue/card_character_farmer_01.png', size: 11749 },
      card_character_fighters: {
        path: 'WEN_01/dialogue/card_character_fighters_01.png',
        size: 14927,
      },
      card_character_fox: { path: 'WEN_01/dialogue/card_character_fox_01.png', size: 14828 },
      card_character_garrisonsolider: {
        path: 'WEN_01/dialogue/card_character_garrisonsolider_01.png',
        size: 14061,
      },
      card_character_socialite: {
        path: 'WEN_01/dialogue/card_character_socialite_01.png',
        size: 16667,
      },
      card_character_wu_guang: {
        path: 'WEN_01/dialogue/card_character_wu_guang_01.png',
        size: 11290,
      },
    },
    fileCount: 367,
  },
  WEN_02: {
    title: { path: 'WEN_02/summary/article_title_WEN_02.png', size: 17672 },
    roles: {
      btnBack: { path: 'WEN_02/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_02/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_02/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_02/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_02/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_02/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_02/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_02/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_02/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_02/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_02/quiz/option_a_01.png', size: 6575 },
      B: { path: 'WEN_02/quiz/option_b_01.png', size: 6575 },
      C: { path: 'WEN_02/quiz/option_c_01.png', size: 6612 },
      D: { path: 'WEN_02/quiz/option_d_01.png', size: 6612 },
    },
    textBoxes: {
      summary: { path: 'WEN_02/summary/summary_text_box.png', size: 391754 },
      homework: { path: 'WEN_02/summary/homework_text_box.png', size: 391754 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_02/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_02/explanation/bg_explanation_01.png', size: 16757748 },
      bg_horse: { path: 'WEN_02/dialogue/bg_horse_01.png', size: 14453884 },
      bg_scroll: { path: 'WEN_02/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_02/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_Confucius: { path: 'WEN_02/dialogue/avatar_Confucius_02.png', size: 17303 },
      avatar_horse: { path: 'WEN_02/dialogue/avatar_horse_01.png', size: 2097181 },
      avatar_ruler: { path: 'WEN_02/dialogue/avatar_ruler_01.png', size: 2840211 },
      avatar_student: { path: 'WEN_02/dialogue/avatar_student_01.png', size: 2352864 },
    },
    characterCards: {
      card_character_horse: { path: 'WEN_02/dialogue/card_character_horse_01.png', size: 11874 },
      card_character_ruler: { path: 'WEN_02/dialogue/card_character_ruler_01.png', size: 15124 },
      card_character_student: {
        path: 'WEN_02/dialogue/card_character_student_01.png',
        size: 13723,
      },
    },
    fileCount: 191,
  },
  WEN_03: {
    title: { path: 'WEN_03/summary/article_title_WEN_03.png', size: 23913 },
    roles: {
      btnBack: { path: 'WEN_03/summary/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_03/summary/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_03/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_03/quiz/btn_completed_01.png', size: 19380 },
      bgm: { path: 'WEN_03/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_03/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_03/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_03/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_03/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_03/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_03/quiz/option_a_01.png', size: 4902 },
      B: { path: 'WEN_03/quiz/option_b_01.png', size: 4902 },
      C: { path: 'WEN_03/quiz/option_c_01.png', size: 4927 },
      D: { path: 'WEN_03/quiz/option_d_01.png', size: 4927 },
    },
    textBoxes: {
      summary: { path: 'WEN_03/summary/summary_text_box.png', size: 391754 },
      homework: { path: 'WEN_03/summary/homework_text_box.png', size: 391754 },
      poem: { path: 'WEN_03/cultural_card/poem_text_box.png', size: 690506 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_03/cultural_card/article_bg.png', size: 16757748 },
      bg_explanation: { path: 'WEN_03/explanation/bg_explanation_01.png', size: 16757748 },
      bg_scroll: { path: 'WEN_03/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_03/summary/bg_summary.png', size: 16757748 },
      bg_temple: { path: 'WEN_03/dialogue/bg_temple_01.png', size: 9651045 },
    },
    avatars: {
      avatar_fan_zhongyan: { path: 'WEN_03/dialogue/avatar_fan_zhongyan_01.png', size: 2145867 },
      avatar_qiankessaoren: { path: 'WEN_03/dialogue/avatar_qiankessaoren_01.png', size: 1587554 },
      avatar_scholar: { path: 'WEN_03/dialogue/avatar_scholar_01.png', size: 1975671 },
      avatar_teng_zijing: { path: 'WEN_03/dialogue/avatar_teng_zijing_01.png', size: 2306242 },
    },
    characterCards: {
      card_character_fan_zhongyan: {
        path: 'WEN_03/dialogue/card_character_fan_zhongyan_01.png',
        size: 15684,
      },
      card_character_qiankessaoren: {
        path: 'WEN_03/dialogue/card_character_qiankessaoren_01.png',
        size: 18569,
      },
      card_character_scholar: {
        path: 'WEN_03/dialogue/card_character_scholar_01.png',
        size: 11104,
      },
      card_character_teng_zijing: {
        path: 'WEN_03/dialogue/card_character_teng_zijing_01.png',
        size: 15906,
      },
      card_fan_zhongyan: { path: 'WEN_03/dialogue/card_fan_zhongyan_02.png', size: 15654 },
      card_qiankessaoren: { path: 'WEN_03/dialogue/card_qiankessaoren_02.png', size: 18631 },
    },
    fileCount: 191,
  },
  WEN_04: {
    title: { path: 'WEN_04/explanation/article_title_WEN_04.png', size: 27371 },
    roles: {
      btnBack: { path: 'WEN_04/explanation/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_04/explanation/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_04/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_04/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_04/explanation/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_04/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_04/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_04/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_04/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_04/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_04/quiz/option_a_01.png', size: 6206 },
      B: { path: 'WEN_04/quiz/option_b_01.png', size: 6206 },
      C: { path: 'WEN_04/quiz/option_c_01.png', size: 6241 },
      D: { path: 'WEN_04/quiz/option_d_01.png', size: 6241 },
    },
    textBoxes: {
      summary: { path: 'WEN_04/summary/summary_text_box.png', size: 572319 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_04/video/article_bg_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_04/explanation/bg_explanation_.png', size: 16757748 },
      bg_fish: { path: 'WEN_04/dialogue/bg_fish_01.png', size: 12020396 },
      bg_scroll: { path: 'WEN_04/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_04/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_huizi: { path: 'WEN_04/dialogue/avatar_huizi_01.png', size: 1932622 },
      avatar_stydent: { path: 'WEN_04/dialogue/avatar_stydent_01.png', size: 1751146 },
      avatar_zhuangzi: { path: 'WEN_04/dialogue/avatar_zhuangzi_01.png', size: 2282102 },
    },
    characterCards: {
      card_characte_huizi: { path: 'WEN_04/dialogue/card_characte_huizi_01.png', size: 12318 },
      card_characte_zhuangzi: {
        path: 'WEN_04/dialogue/card_characte_zhuangzi_01.png',
        size: 10659,
      },
      card_character_student: {
        path: 'WEN_04/dialogue/card_character_student_01.png',
        size: 12239,
      },
    },
    fileCount: 207,
  },
  WEN_05: {
    title: { path: 'WEN_05/summary/article_title_WEN_05.png', size: 22838 },
    roles: {
      btnBack: { path: 'WEN_05/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_05/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_05/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_05/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_05/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_05/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_05/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_05/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_05/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_05/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_05/quiz/option_a_01.png', size: 3794 },
      B: { path: 'WEN_05/quiz/option_b_01.png', size: 3794 },
      C: { path: 'WEN_05/quiz/option_c_01.png', size: 3809 },
      D: { path: 'WEN_05/quiz/option_d_01.png', size: 3809 },
    },
    textBoxes: {
      summary: { path: 'WEN_05/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_05/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_05/explanation/bg_explanation_01.png', size: 16757748 },
      bg_palace: { path: 'WEN_05/quiz/bg_palace_01.png', size: 16956805 },
      bg_scroll: { path: 'WEN_05/quiz/bg_scroll_01.png', size: 2898868 },
      bg_study_palace: { path: 'WEN_05/dialogue/bg_study_palace_01.png', size: 16956805 },
      bg_summary: { path: 'WEN_05/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_anling_jun: { path: 'WEN_05/dialogue/avatar_anling_jun_01.png', size: 2016978 },
      avatar_historian: { path: 'WEN_05/dialogue/avatar_historian_01.png', size: 1885286 },
      avatar_king_qin: { path: 'WEN_05/dialogue/avatar_king_qin_01.png', size: 1819892 },
      avatar_messager: { path: 'WEN_05/dialogue/avatar_messager_01.png', size: 2170734 },
      avatar_tang_ju: { path: 'WEN_05/dialogue/avatar_tang_ju_01.png', size: 2273137 },
    },
    characterCards: {
      card_character_anling_jun: {
        path: 'WEN_05/dialogue/card_character_anling_jun_01.png',
        size: 17139,
      },
      card_character_historian: {
        path: 'WEN_05/dialogue/card_character_historian_01.png',
        size: 11754,
      },
      card_character_king_qin: {
        path: 'WEN_05/dialogue/card_character_king_qin_01.png',
        size: 12379,
      },
      card_character_messager: {
        path: 'WEN_05/dialogue/card_character_messager_01.png',
        size: 14558,
      },
      card_character_tang_ju: {
        path: 'WEN_05/dialogue/card_character_tang_ju_01.png',
        size: 12884,
      },
    },
    fileCount: 311,
  },
  WEN_06: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_07: {
    title: { path: 'WEN_07/summary/article_title_WEN_07.png', size: 23913 },
    roles: {
      btnBack: { path: 'WEN_07/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_07/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_07/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_07/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_07/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_07/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_07/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_07/dialogue/card_bamboo_02.png', size: 288900 },
      bgScroll: { path: 'WEN_07/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_07/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_07/quiz/option_a_01.png', size: 3794 },
      B: { path: 'WEN_07/quiz/option_b_01.png', size: 3794 },
      C: { path: 'WEN_07/quiz/option_c_01.png', size: 3809 },
      D: { path: 'WEN_07/quiz/option_d_01.png', size: 3809 },
    },
    textBoxes: {
      summary: { path: 'WEN_07/summary/summary_text_box.png', size: 391754 },
      homework: { path: 'WEN_07/summary/homework_text_box.png', size: 391754 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_07/video/article_bg_01.png', size: 16757748 },
      bg_camp: { path: 'WEN_07/dialogue/bg_camp_01.png', size: 288900 },
      bg_explanation: { path: 'WEN_07/explanation/bg_explanation_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_07/explanation/bg_explanation_.png', size: 16757748 },
      bg_scroll: { path: 'WEN_07/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_07/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_bimenshili: { path: 'WEN_07/dialogue/avatar_bimenshili_01.png', size: 3056981 },
      avatar_duwei: { path: 'WEN_07/dialogue/avatar_duwei_01.png', size: 2142096 },
      avatar_emperor_wen_of_han: {
        path: 'WEN_07/dialogue/avatar_emperor_wen_of_han_01.png',
        size: 2525919,
      },
      avatar_forerunner: { path: 'WEN_07/dialogue/avatar_forerunner_01.png', size: 2349699 },
      avatar_messenger: { path: 'WEN_07/dialogue/avatar_messenger_02.png', size: 2243967 },
      avatar_shilang: { path: 'WEN_07/dialogue/avatar_shilang_01.png', size: 1954322 },
      avatar_zhou_yafu: { path: 'WEN_07/dialogue/avatar_zhou_yafu_02.png', size: 2542057 },
    },
    characterCards: {
      'card_character-emperor_wen_of_han': {
        path: 'WEN_07/dialogue/card_character-emperor_wen_of_han_01.png',
        size: 16880,
      },
      card_character_bimenshili: {
        path: 'WEN_07/dialogue/card_character_bimenshili_01.png',
        size: 14938,
      },
      card_character_duwei: { path: 'WEN_07/dialogue/card_character_duwei_01.png', size: 17002 },
      card_character_messenger: {
        path: 'WEN_07/dialogue/card_character_messenger_01.png',
        size: 12763,
      },
      card_character_servant: {
        path: 'WEN_07/dialogue/card_character_servant_03.png',
        size: 13147,
      },
      card_character_shilang: {
        path: 'WEN_07/dialogue/card_character_shilang_01.png',
        size: 13147,
      },
      card_character_shizhe: { path: 'WEN_07/dialogue/card_character_shizhe_02.png', size: 12763 },
      card_character_xianqu: { path: 'WEN_07/dialogue/card_character_xianqu_01.png', size: 13941 },
      card_character_zhou_yafu: {
        path: 'WEN_07/dialogue/card_character_zhou_yafu_01.png',
        size: 13784,
      },
    },
    fileCount: 301,
  },
  WEN_08: {
    title: { path: 'WEN_08/explanation/article_title_WEN_08.png', size: 17571 },
    roles: {
      btnBack: { path: 'WEN_08/explanation/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_08/explanation/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_08/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_08/quiz/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_08/explanation/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_08/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_08/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_08/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_08/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_08/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_08/quiz/option_a_01.png', size: 6074 },
      B: { path: 'WEN_08/quiz/option_b_01.png', size: 6043 },
      C: { path: 'WEN_08/quiz/option_c_01.png', size: 6108 },
      D: { path: 'WEN_08/quiz/option_d_01.png', size: 6108 },
    },
    textBoxes: {
      summary: { path: 'WEN_08/summary/summary_text_box.png', size: 421927 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_08/video/article_bg_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_08/explanation/bg_explanation_.png', size: 16757748 },
      bg_scroll: { path: 'WEN_08/quiz/bg_scroll_01.png', size: 2898868 },
      bg_snow: { path: 'WEN_08/dialogue/bg_snow_01.png', size: 11656440 },
      bg_summary: { path: 'WEN_08/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_Grand_Tutor_Xie: {
        path: 'WEN_08/dialogue/avatar_Grand_Tutor_Xie_01.png',
        size: 2545273,
      },
      avatar_hu_er: { path: 'WEN_08/dialogue/avatar_hu_er_01.png', size: 1076105 },
      avatar_student: { path: 'WEN_08/dialogue/avatar_student_01.png', size: 1489554 },
      avatar_xie_dao_yun: { path: 'WEN_08/dialogue/avatar_xie_dao_yun_01.png', size: 1282234 },
    },
    characterCards: {
      card_character_Grand_Tutor_Xie: {
        path: 'WEN_08/dialogue/card_character_Grand_Tutor_Xie_01.png',
        size: 16093,
      },
      card_character_hu_er: { path: 'WEN_08/dialogue/card_character_hu_er_01.png', size: 10971 },
      card_character_student: {
        path: 'WEN_08/dialogue/card_character_student_01.png',
        size: 12239,
      },
      card_character_xie_dao_yun: {
        path: 'WEN_08/dialogue/card_character_xie_dao_yun_01.png',
        size: 15836,
      },
    },
    fileCount: 199,
  },
  WEN_09: {
    title: { path: 'WEN_09/explanation/article_title_WEN_09.png', size: 24411 },
    roles: {
      btnBack: { path: 'WEN_09/explanation/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_09/explanation/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_09/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_09/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_09/explanation/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_09/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_09/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_09/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_09/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_09/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_09/quiz/option_a_01.png', size: 6043 },
      B: { path: 'WEN_09/quiz/option_b_01.png', size: 6043 },
      C: { path: 'WEN_09/quiz/option_c_01.png', size: 6108 },
      D: { path: 'WEN_09/quiz/option_d_01.png', size: 6108 },
    },
    textBoxes: {
      summary: { path: 'WEN_09/summary/summary_text_box.png', size: 391754 },
      homework: { path: 'WEN_09/summary/homework_text_box.png', size: 391754 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_09/video/article_bg_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_09/explanation/bg_explanation_.png', size: 16757748 },
      bg_garden: { path: 'WEN_09/dialogue/bg_garden_01.png', size: 8098691 },
      bg_scroll: { path: 'WEN_09/quiz/bg_scroll_01.png', size: 2898868 },
      bg_study_room: { path: 'WEN_09/dialogue/bg_study_room_01.png', size: 10660855 },
      bg_summary: { path: 'WEN_09/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_chen_yaochi: { path: 'WEN_09/dialogue/avatar_chen_yaochi_01.png', size: 1765321 },
      avatar_oil_seller: { path: 'WEN_09/dialogue/avatar_oil_seller_01.png', size: 2934052 },
      avatar_servant: { path: 'WEN_09/dialogue/avatar_servant_01.png', size: 1035716 },
    },
    characterCards: {
      card_character_chen_yaozi: {
        path: 'WEN_09/dialogue/card_character_chen_yaozi_01.png',
        size: 18239,
      },
      card_character_oil_seller: {
        path: 'WEN_09/dialogue/card_character_oil_seller_01.png',
        size: 17565,
      },
      card_character_servant: {
        path: 'WEN_09/dialogue/card_character_servant_01.png',
        size: 14581,
      },
    },
    fileCount: 261,
  },
  WEN_10: {
    title: { path: 'WEN_10/explanation/article_title_WEN_10.png', size: 26592 },
    roles: {
      btnBack: { path: 'WEN_10/explanation/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_10/explanation/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_10/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_10/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_10/explanation/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_10/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_10/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_10/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_10/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_10/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_10/quiz/option_a_01.png', size: 3794 },
      B: { path: 'WEN_10/quiz/option_b_01.png', size: 3794 },
      C: { path: 'WEN_10/quiz/option_c_01.png', size: 3809 },
      D: { path: 'WEN_10/quiz/option_d_01.png', size: 3809 },
    },
    textBoxes: {
      summary: { path: 'WEN_10/summary/summary_text_box.png', size: 421927 },
      homework: { path: 'WEN_10/summary/homework_text_box.png', size: 421927 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_10/video/article_bg_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_10/explanation/bg_explanation_.png', size: 16757748 },
      bg_scroll: { path: 'WEN_10/quiz/bg_scroll_01.png', size: 2898868 },
      bg_snow: { path: 'WEN_10/dialogue/bg_snow_01.png', size: 7475833 },
      bg_summary: { path: 'WEN_10/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_jinlingke: { path: 'WEN_10/dialogue/avatar_jinlingke.png', size: 2303330 },
      avatar_tong_zi: { path: 'WEN_10/dialogue/avatar_tong_zi_01.png', size: 1658705 },
      avatar_zhou_zi: { path: 'WEN_10/dialogue/avatar_zhou_zi_01.png', size: 2165231 },
    },
    characterCards: {
      card_character_jinlingke: {
        path: 'WEN_10/dialogue/card_character_jinlingke_01.png',
        size: 18273,
      },
      card_character_tong_zi: {
        path: 'WEN_10/dialogue/card_character_tong_zi_01.png',
        size: 11441,
      },
      card_character_zhou_zi: {
        path: 'WEN_10/dialogue/card_character_zhou_zi_01.png',
        size: 11492,
      },
    },
    fileCount: 225,
  },
  WEN_11: {
    title: { path: 'WEN_11/explanation/article_title_WEN_11.png', size: 26617 },
    roles: {
      btnBack: { path: 'WEN_11/explanation/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_11/explanation/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_11/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_11/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_11/explanation/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_11/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_11/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_11/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_11/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_11/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_11/quiz/option_a_01.png', size: 6043 },
      B: { path: 'WEN_11/quiz/option_b_01.png', size: 6043 },
      C: { path: 'WEN_11/quiz/option_c_01.png', size: 6108 },
      D: { path: 'WEN_11/quiz/option_d_01.png', size: 6108 },
    },
    textBoxes: {
      summary: { path: 'WEN_11/summary/summary_text_box.png', size: 421927 },
      homework: { path: 'WEN_11/summary/homework_text_box.png', size: 421927 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_11/video/article_bg_01.png', size: 16757748 },
      bg_camp: { path: 'WEN_11/dialogue/bg_camp_01.png', size: 12906950 },
      bg_scroll: { path: 'WEN_11/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_11/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_lu_su: { path: 'WEN_11/dialogue/avatar_lu_su_01.png', size: 1318749 },
      avatar_lv_meng: { path: 'WEN_11/dialogue/avatar_lv_meng_01.png', size: 1099617 },
      avatar_sun_quan: { path: 'WEN_11/dialogue/avatar_sun_quan_01.png', size: 1245796 },
    },
    characterCards: {
      card_character_lu_su: { path: 'WEN_11/dialogue/card_character_lu_su_01.png', size: 11955 },
      card_character_lv_meng: {
        path: 'WEN_11/dialogue/card_character_lv_meng_01.png',
        size: 12778,
      },
      card_character_sun_quan: {
        path: 'WEN_11/dialogue/card_character_sun_quan_01.png',
        size: 13897,
      },
    },
    fileCount: 238,
  },
  WEN_12: {
    title: { path: 'WEN_12/summary/article_title_WEN_12.png', size: 24681 },
    roles: {
      btnBack: { path: 'WEN_12/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_12/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_12/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_12/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_12/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_12/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_12/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_12/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_12/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_12/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_12/quiz/option_a_01.png', size: 6206 },
      B: { path: 'WEN_12/quiz/option_b_01.png', size: 6206 },
      C: { path: 'WEN_12/quiz/option_c_01.png', size: 6241 },
      D: { path: 'WEN_12/quiz/option_d_01.png', size: 6241 },
    },
    textBoxes: {
      summary: { path: 'WEN_12/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_12/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_12/explanation/bg_explanation_01.png', size: 16757748 },
      bg_scroll: { path: 'WEN_12/quiz/bg_scroll_01.png', size: 2898868 },
      bg_study_room: { path: 'WEN_12/dialogue/bg_study_room_01.png', size: 10660855 },
      bg_summary: { path: 'WEN_12/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_concubine: { path: 'WEN_12/dialogue/avatar_concubine_01.png', size: 2195546 },
      avatar_king_wei_of_qi: {
        path: 'WEN_12/dialogue/avatar_king_wei_of_qi_01.png',
        size: 1991660,
      },
      avatar_retainer: { path: 'WEN_12/dialogue/avatar_retainer_01.png', size: 1976738 },
      avatar_wife: { path: 'WEN_12/dialogue/avatar_wife_01.png', size: 1792666 },
      avatar_zou_ji: { path: 'WEN_12/dialogue/avatar_zou_ji_01.png', size: 1977087 },
      avatarr_guest: { path: 'WEN_12/dialogue/avatarr_guest_01.png', size: 1716961 },
    },
    characterCards: {
      card_character_concubine: {
        path: 'WEN_12/dialogue/card_character_concubine_01.png',
        size: 11304,
      },
      card_character_guest: { path: 'WEN_12/dialogue/card_character_guest_01.png', size: 11015 },
      card_character_king_wei_of_qi: {
        path: 'WEN_12/dialogue/card_character_king_wei_of_qi_01.png',
        size: 15639,
      },
      card_character_retainer: {
        path: 'WEN_12/dialogue/card_character_retainer_01.png',
        size: 12441,
      },
      card_character_wife: { path: 'WEN_12/dialogue/card_character_wife_01.png', size: 10429 },
      card_character_zou_ji: { path: 'WEN_12/dialogue/card_character_zou_ji_01.png', size: 13060 },
    },
    fileCount: 293,
  },
  WEN_13: {
    title: { path: 'WEN_13/summary/article_title_WEN_13.png', size: 29275 },
    roles: {
      btnBack: { path: 'WEN_13/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_13/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_13/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_13/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_13/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_13/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_13/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_13/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_13/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_13/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_13/quiz/option_a_01.png', size: 6575 },
      B: { path: 'WEN_13/quiz/option_b_01.png', size: 6575 },
      C: { path: 'WEN_13/quiz/option_c_01.png', size: 6612 },
      D: { path: 'WEN_13/quiz/option_d_01.png', size: 6612 },
    },
    textBoxes: {
      summary: { path: 'WEN_13/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_13/video/article_bg_01.png', size: 16757748 },
      bg_camp: { path: 'WEN_13/dialogue/bg_camp_01.png', size: 12906950 },
      bg_explanation: { path: 'WEN_13/explanation/bg_explanation_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_13/explanation/bg_explanation_.png', size: 16757748 },
      bg_scroll: { path: 'WEN_13/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_13/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_cao_gui: { path: 'WEN_13/dialogue/avatar_cao_gui_01.png', size: 1761305 },
      avatar_duke_zhuang_of_lu: {
        path: 'WEN_13/dialogue/avatar_duke_zhuang_of_lu_01.png',
        size: 2105206,
      },
      avatar_senate: { path: 'WEN_13/dialogue/avatar_senate_01.png', size: 2196441 },
      avatar_villager: { path: 'WEN_13/dialogue/avatar_villager_01.png', size: 2367518 },
    },
    characterCards: {
      card_character_cao_gui: {
        path: 'WEN_13/dialogue/card_character_cao_gui_01.png',
        size: 12129,
      },
      card_character_duke_zhuang_of_lu: {
        path: 'WEN_13/dialogue/card_character_duke_zhuang_of_lu_01.png',
        size: 14926,
      },
      card_character_senate: { path: 'WEN_13/dialogue/card_character_senate_01.png', size: 16030 },
      card_character_villager: {
        path: 'WEN_13/dialogue/card_character_villager_01.png',
        size: 13247,
      },
    },
    fileCount: 360,
  },
  WEN_14: {
    title: { path: 'WEN_14/summary/article_title_WEN_14.png', size: 19458 },
    roles: {
      btnBack: { path: 'WEN_14/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_14/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_14/quiz/btn_submit_02.png', size: 22122 },
      btnCompleted: { path: 'WEN_14/quiz/btn_completed_02.png', size: 19380 },
      bgm: { path: 'WEN_14/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_14/quiz/grade_area_02.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_14/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_14/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_14/quiz/bg_scroll_03.png', size: 2898868 },
      bgSummary: { path: 'WEN_14/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_14/quiz/option_a_03.png', size: 7123 },
      B: { path: 'WEN_14/quiz/option_b_03.png', size: 7225 },
      C: { path: 'WEN_14/quiz/option_c_03.png', size: 7203 },
      D: { path: 'WEN_14/quiz/option_d_03.png', size: 7475 },
    },
    textBoxes: {
      summary: { path: 'WEN_14/summary/summary_text_box.png', size: 651551 },
      proverb: { path: 'WEN_14/cultural_card/proverb_text_box.png', size: 542263 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_14/cultural_card/article_bg.png', size: 16757748 },
      bg_Confucius: { path: 'WEN_14/dialogue/bg_Confucius_01.png', size: 10931958 },
      bg_explanation: { path: 'WEN_14/explanation/bg_explanation_01.png', size: 16757748 },
      bg_scroll: { path: 'WEN_14/quiz/bg_scroll_03.png', size: 2898868 },
      bg_summary: { path: 'WEN_14/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_Confucius: { path: 'WEN_14/dialogue/avatar_Confucius_01.png', size: 2145103 },
      avatar_cao_gui: { path: 'WEN_14/dialogue/avatar_cao_gui_12.png', size: 1886154 },
      avatar_student: { path: 'WEN_14/dialogue/avatar_student_01.png', size: 1506847 },
      avatar_zeng_zi: { path: 'WEN_14/dialogue/avatar_zeng_zi_01.png', size: 1592112 },
      avatar_zixia: { path: 'WEN_14/dialogue/avatar_zixia_01.png', size: 1853090 },
    },
    characterCards: {
      card_character_Confucius: {
        path: 'WEN_14/dialogue/card_character_Confucius_01.png',
        size: 10694,
      },
      card_character_cao_gui: {
        path: 'WEN_14/dialogue/card_character_cao_gui_12.png',
        size: 12129,
      },
      card_character_student: {
        path: 'WEN_14/dialogue/card_character_student_01.png',
        size: 12239,
      },
      card_character_zeng_zi: {
        path: 'WEN_14/dialogue/card_character_zeng_zi_01.png',
        size: 11352,
      },
      card_character_zixia: { path: 'WEN_14/dialogue/card_character_zixia_01.png', size: 11757 },
    },
    fileCount: 238,
  },
  WEN_15: {
    title: { path: 'WEN_15/summary/article_title_WEN_15.png', size: 21066 },
    roles: {
      btnBack: { path: 'WEN_15/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_15/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_15/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_15/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_15/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_15/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_15/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_15/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_15/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_15/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_15/quiz/option_a_01.png', size: 6298 },
      B: { path: 'WEN_15/quiz/option_b_01.png', size: 6298 },
      C: { path: 'WEN_15/quiz/option_c_01.png', size: 6334 },
      D: { path: 'WEN_15/quiz/option_d_01.png', size: 6334 },
    },
    textBoxes: {
      summary: { path: 'WEN_15/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_15/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_15/explanation/bg_explanation_01.png', size: 16757748 },
      bg_jiezishu: { path: 'WEN_15/dialogue/bg_jiezishu_01.png', size: 4746127 },
      bg_scroll: { path: 'WEN_15/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_15/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_messager: { path: 'WEN_15/dialogue/avatar_messager_01.png', size: 1753849 },
      avatar_zhuge_liang: { path: 'WEN_15/dialogue/avatar_zhuge_liang_01.png', size: 1608447 },
    },
    characterCards: {
      card_character_messager: {
        path: 'WEN_15/dialogue/card_character_messager_01.png',
        size: 12870,
      },
      card_character_zhuge_liang: {
        path: 'WEN_15/dialogue/card_character_zhuge_liang_01.png',
        size: 16023,
      },
    },
    fileCount: 172,
  },
  WEN_16: {
    title: { path: 'WEN_16/explanation/article_title_WEN_16.png', size: 22424 },
    roles: {
      btnBack: { path: 'WEN_16/explanation/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_16/explanation/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_16/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_16/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_16/explanation/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_16/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_16/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_16/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_16/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_16/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_16/quiz/option_a_01.png', size: 6043 },
      B: { path: 'WEN_16/quiz/option_b_01.png', size: 6043 },
      C: { path: 'WEN_16/quiz/option_c_01.png', size: 6108 },
      D: { path: 'WEN_16/quiz/option_d_01.png', size: 6108 },
    },
    textBoxes: {
      summary: { path: 'WEN_16/summary/summary_text_box.png', size: 428846 },
      proverb: { path: 'WEN_16/cultural_card/proverb_text_box.png', size: 690506 },
      explanation: { path: 'WEN_16/cultural_card/explanation_text_box.png', size: 321259 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_16/cultural_card/article_bg.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_16/explanation/bg_explanation_.png', size: 16757748 },
      bg_scroll: { path: 'WEN_16/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_16/summary/bg_summary.png', size: 16757748 },
      bg_well: { path: 'WEN_16/dialogue/bg_well_01.png', size: 11460421 },
    },
    avatars: {
      avatar_ding_shi: { path: 'WEN_16/dialogue/avatar_ding_shi_01.png', size: 2727254 },
      avatar_teenager: { path: 'WEN_16/dialogue/avatar_teenager_01.png', size: 2201595 },
    },
    characterCards: {
      card_character_ding_shi: {
        path: 'WEN_16/dialogue/card_character_ding_shi_01.png',
        size: 11061,
      },
      card_character_spreader: {
        path: 'WEN_16/dialogue/card_character_spreader_01.png',
        size: 12717,
      },
      card_character_teenager: {
        path: 'WEN_16/dialogue/card_character_teenager_01.png',
        size: 11766,
      },
    },
    fileCount: 211,
  },
  WEN_17: {
    title: { path: 'WEN_17/explanation/article_title_WEN_17.png', size: 20750 },
    roles: {
      btnBack: { path: 'WEN_17/explanation/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_17/explanation/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_17/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_17/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_17/explanation/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_17/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_17/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_17/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_17/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_17/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_17/quiz/option_a_01.png', size: 6043 },
      B: { path: 'WEN_17/quiz/option_b_01.png', size: 6043 },
      C: { path: 'WEN_17/quiz/option_c_01.png', size: 6108 },
      D: { path: 'WEN_17/quiz/option_d_01.png', size: 6108 },
    },
    textBoxes: {
      summary: { path: 'WEN_17/summary/summary_text_box.png', size: 421927 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_17/video/article_bg_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_17/explanation/bg_explanation_.png', size: 16757748 },
      bg_scroll: { path: 'WEN_17/quiz/bg_scroll_01.png', size: 2898868 },
      bg_street: { path: 'WEN_17/dialogue/bg_street_01.png', size: 14768238 },
      bg_summary: { path: 'WEN_17/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_qiren: { path: 'WEN_17/dialogue/avatar_qiren_01.png', size: 2275131 },
      avatar_xiaozhizhe: { path: 'WEN_17/dialogue/avatar_xiaozhizhe_01.png', size: 2249962 },
      avatar_youxuezhe: { path: 'WEN_17/dialogue/avatar_youxuezhe_01.png', size: 2484283 },
    },
    characterCards: {
      card_character_qiren: { path: 'WEN_17/dialogue/card_character_qiren_01.png', size: 11924 },
      card_character_xiaozhizhe: {
        path: 'WEN_17/dialogue/card_character_xiaozhizhe_01.png',
        size: 15240,
      },
      card_character_youxuezhe: {
        path: 'WEN_17/dialogue/card_character_youxuezhe_01.png',
        size: 16877,
      },
    },
    fileCount: 216,
  },
  WEN_18: {
    title: { path: 'WEN_18/summary/article_title_WEN_18.png', size: 26166 },
    roles: {
      btnBack: { path: 'WEN_18/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_18/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_18/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_18/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_18/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_18/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_18/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_18/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_18/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_18/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_18/quiz/option_a_01.png', size: 6575 },
      B: { path: 'WEN_18/quiz/option_b_01.png', size: 6575 },
      C: { path: 'WEN_18/quiz/option_c_01.png', size: 6612 },
      D: { path: 'WEN_18/quiz/option_d_01.png', size: 6612 },
    },
    textBoxes: {
      summary: { path: 'WEN_18/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_18/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_18/explanation/bg_explanation_01.png', size: 16757748 },
      bg_mountain: { path: 'WEN_18/dialogue/bg_mountain_01.png', size: 17160447 },
      bg_scroll: { path: 'WEN_18/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_18/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_eldest_son: { path: 'WEN_18/dialogue/avatar_eldest_son_01.png', size: 1986781 },
      avatar_wife: { path: 'WEN_18/dialogue/avatar_wife_01.png', size: 1980324 },
      avatar_wife_person: { path: 'WEN_18/dialogue/avatar_wife_person_01.png', size: 2260807 },
      avatar_yu_gong: { path: 'WEN_18/dialogue/avatar_yu_gong_01.png', size: 1901450 },
    },
    characterCards: {
      card_character_cao_gui: {
        path: 'WEN_18/dialogue/card_character_cao_gui_13.png',
        size: 14477,
      },
      card_character_eldest_son: {
        path: 'WEN_18/dialogue/card_character_eldest_son_01.png',
        size: 11376,
      },
      card_character_other_people: {
        path: 'WEN_18/dialogue/card_character_other_people_01.png',
        size: 15349,
      },
      card_character_wife: { path: 'WEN_18/dialogue/card_character_wife_01.png', size: 10429 },
      card_character_wise_person: {
        path: 'WEN_18/dialogue/card_character_wise_person_01.png',
        size: 13224,
      },
      card_character_yu_gong: {
        path: 'WEN_18/dialogue/card_character_yu_gong_01.png',
        size: 14477,
      },
    },
    fileCount: 246,
  },
  WEN_19: {
    title: { path: 'WEN_19/explanation/article_title_WEN_19.png', size: 24264 },
    roles: {
      btnBack: { path: 'WEN_19/explanation/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_19/explanation/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_19/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_19/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_19/explanation/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_19/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_19/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_19/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_19/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_19/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_19/quiz/option_a_01.png', size: 6206 },
      B: { path: 'WEN_19/quiz/option_b_01.png', size: 6206 },
      C: { path: 'WEN_19/quiz/option_c_01.png', size: 6241 },
      D: { path: 'WEN_19/quiz/option_d_01.png', size: 6241 },
    },
    textBoxes: {
      summary: { path: 'WEN_19/summary/summary_text_box.png', size: 572319 },
      proverb: { path: 'WEN_19/cultural_card/proverb_text_box.png', size: 690506 },
      explanation: { path: 'WEN_19/cultural_card/explanation_text_box.png', size: 321259 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_19/cultural_card/article_bg.png', size: 16757748 },
      bg_door: { path: 'WEN_19/dialogue/bg_door_01.png', size: 10796531 },
      bg_explanation_: { path: 'WEN_19/explanation/bg_explanation_.png', size: 16757748 },
      bg_scroll: { path: 'WEN_19/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_19/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_friend: { path: 'WEN_19/dialogue/avatar_friend_01.png', size: 1913422 },
      avatar_servant: { path: 'WEN_19/dialogue/avatar_servant_01.png', size: 1932957 },
      avatar_yuan_fang: { path: 'WEN_19/dialogue/avatar_yuan_fang_01.png', size: 1761308 },
    },
    characterCards: {
      card_characte_friend: { path: 'WEN_19/dialogue/card_characte_friend_01.png', size: 12933 },
      card_characte_yuan_fang: {
        path: 'WEN_19/dialogue/card_characte_yuan_fang_01.png',
        size: 11801,
      },
      card_character_servant: {
        path: 'WEN_19/dialogue/card_character_servant_01.png',
        size: 14581,
      },
      card_character_servat: { path: 'WEN_19/dialogue/card_character_servat_03.png', size: 14581 },
      card_character_yuan_fang: {
        path: 'WEN_19/dialogue/card_character_yuan_fang_04.png',
        size: 11801,
      },
    },
    fileCount: 208,
  },
  WEN_20: {
    title: { path: 'WEN_20/summary/article_title_WEN_20.png', size: 23157 },
    roles: {
      btnBack: { path: 'WEN_20/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_20/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_20/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_20/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_20/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_20/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_20/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_20/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_20/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_20/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_20/quiz/option_a_01.png', size: 6298 },
      B: { path: 'WEN_20/quiz/option_b_01.png', size: 6298 },
      C: { path: 'WEN_20/quiz/option_c_01.png', size: 6334 },
      D: { path: 'WEN_20/quiz/option_d_01.png', size: 6334 },
    },
    textBoxes: {
      summary: { path: 'WEN_20/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_20/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_20/explanation/bg_explanation_01.png', size: 16757748 },
      bg_house: { path: 'WEN_20/dialogue/bg_house_01.png', size: 14361233 },
      bg_scroll: { path: 'WEN_20/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_20/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_hezhoushusheng: {
        path: 'WEN_20/dialogue/avatar_hezhoushusheng_01.png',
        size: 1185653,
      },
      avatar_liu_yuxi: { path: 'WEN_20/dialogue/avatar_liu_yuxi_01.png', size: 1614939 },
      avatar_youxuezhe: { path: 'WEN_20/dialogue/avatar_youxuezhe_03.png', size: 1469592 },
    },
    characterCards: {
      card_character_hezhoushusheng: {
        path: 'WEN_20/dialogue/card_character_hezhoushusheng_01.png',
        size: 15155,
      },
      card_character_liu_yuxi: {
        path: 'WEN_20/dialogue/card_character_liu_yuxi_01.png',
        size: 16724,
      },
    },
    fileCount: 187,
  },
  WEN_21: {
    title: { path: 'WEN_21/dialogue/article_title_WEN_21_01.png', size: 24790 },
    roles: {
      btnBack: { path: 'WEN_21/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_21/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_21/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_21/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_21/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_21/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_21/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_21/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_21/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_21/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_21/quiz/option_a_01.png', size: 6298 },
      B: { path: 'WEN_21/quiz/option_b_01.png', size: 6298 },
      C: { path: 'WEN_21/quiz/option_c_01.png', size: 6334 },
      D: { path: 'WEN_21/quiz/option_d_01.png', size: 6334 },
    },
    textBoxes: {
      summary: { path: 'WEN_21/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_21/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_21/explanation/bg_explanation_01.png', size: 16757748 },
      bg_lotu: { path: 'WEN_21/dialogue/bg_lotu_01.png', size: 6662772 },
      bg_scroll: { path: 'WEN_21/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_21/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avata_zhou_dunyi: { path: 'WEN_21/dialogue/avata_zhou_dunyi_03.png', size: 1256933 },
      avatar_liansheng: { path: 'WEN_21/dialogue/avatar_liansheng_01.png', size: 2140084 },
      'avatar_liansheng_03.png1': {
        path: 'WEN_21/dialogue/avatar_liansheng_03.png1.png',
        size: 2140084,
      },
      avatar_zhou_dunyi: { path: 'WEN_21/dialogue/avatar_zhou_dunyi_01.png', size: 1286992 },
      avatarr_liansheng: { path: 'WEN_21/dialogue/avatarr_liansheng_04.png', size: 2044672 },
    },
    characterCards: {
      card_character_liansheng: {
        path: 'WEN_21/dialogue/card_character_liansheng_01.png',
        size: 16956,
      },
      card_character_pu_songling: {
        path: 'WEN_21/dialogue/card_character_pu_songling_01.png',
        size: 12736,
      },
      card_character_zhou_dunyi: {
        path: 'WEN_21/dialogue/card_character_zhou_dunyi_02.png',
        size: 16956,
      },
      card_characterr_liansheng: {
        path: 'WEN_21/dialogue/card_characterr_liansheng_04.png',
        size: 12736,
      },
    },
    fileCount: 184,
  },
  WEN_22: {
    title: { path: 'WEN_22/summary/article_title_WEN_22.png', size: 11953 },
    roles: {
      btnBack: { path: 'WEN_22/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_22/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_22/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_22/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_22/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_22/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_22/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_22/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_22/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_22/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_22/quiz/option_a_01.png', size: 6298 },
      B: { path: 'WEN_22/quiz/option_b_01.png', size: 6298 },
      C: { path: 'WEN_22/quiz/option_c_01.png', size: 6334 },
      D: { path: 'WEN_22/quiz/option_d_01.png', size: 6334 },
    },
    textBoxes: {
      summary: { path: 'WEN_22/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_22/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_22/explanation/bg_explanation_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_22/explanation/bg_explanation_.png', size: 16757748 },
      bg_scroll: { path: 'WEN_22/quiz/bg_scroll_01.png', size: 2898868 },
      bg_study_room: { path: 'WEN_22/dialogue/bg_study_room_01.png', size: 10660855 },
      bg_summary: { path: 'WEN_22/summary/bg_summary.png', size: 16757748 },
      bg_tea: { path: 'WEN_22/dialogue/bg_tea_01.png', size: 9733125 },
      bg_wolf: { path: 'WEN_22/dialogue/bg_wolf_01.png', size: 11565540 },
    },
    avatars: {
      avatar_butcher: { path: 'WEN_22/dialogue/avatar_butcher_01.png', size: 1767836 },
      avatar_pu_songling: { path: 'WEN_22/dialogue/avatar_pu_songling_01.png', size: 1992842 },
    },
    characterCards: {
      card_character_butcher: {
        path: 'WEN_22/dialogue/card_character_butcher_01.png',
        size: 11821,
      },
      card_character_pu_songling: {
        path: 'WEN_22/dialogue/card_character_pu_songling_01.png',
        size: 18816,
      },
    },
    fileCount: 193,
  },
  WEN_23: {
    title: { path: 'WEN_23/summary/article_title_WEN_23.png', size: 17173 },
    roles: {
      btnBack: { path: 'WEN_23/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_23/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_23/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_23/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_23/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_23/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_23/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_23/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_23/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_23/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_23/quiz/option_a_01.png', size: 6298 },
      B: { path: 'WEN_23/quiz/option_b_01.png', size: 6298 },
      C: { path: 'WEN_23/quiz/option_c_01.png', size: 6334 },
      D: { path: 'WEN_23/quiz/option_d_01.png', size: 6334 },
    },
    textBoxes: {
      summary: { path: 'WEN_23/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_23/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_23/explanation/bg_explanation_01.png', size: 16757748 },
      bg_explanation_: { path: 'WEN_23/explanation/bg_explanation_.png', size: 16757748 },
      bg_factory: { path: 'WEN_23/dialogue/bg_factory_01.png', size: 7318657 },
      bg_scroll: { path: 'WEN_23/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_23/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_bi_sheng: { path: 'WEN_23/dialogue/avatar_bi_sheng_01.png', size: 562967 },
      avatar_student: { path: 'WEN_23/dialogue/avatar_student_01.png', size: 415659 },
    },
    characterCards: {
      card_character_bi_sheng: {
        path: 'WEN_23/dialogue/card_character_bi_sheng_01.png',
        size: 11372,
      },
      card_character_student: {
        path: 'WEN_23/dialogue/card_character_student_01.png',
        size: 13723,
      },
    },
    fileCount: 199,
  },
  WEN_24: {
    title: { path: 'WEN_24/cultural_card/article_title_WEN_24.png', size: 23819 },
    roles: {
      btnBack: { path: 'WEN_24/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_24/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_24/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_24/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_24/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_24/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_24/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_24/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_24/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_24/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_24/quiz/option_a_01.png', size: 6575 },
      B: { path: 'WEN_24/quiz/option_b_01.png', size: 6575 },
      C: { path: 'WEN_24/quiz/option_c_01.png', size: 6612 },
      D: { path: 'WEN_24/quiz/option_d_01.png', size: 6612 },
    },
    textBoxes: {
      summary: { path: 'WEN_24/summary/summary_text_box.png', size: 651551 },
      proverb: { path: 'WEN_24/cultural_card/proverb_text_box.png', size: 542263 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_24/cultural_card/article_bg.png', size: 16757748 },
      bg_explanation: { path: 'WEN_24/explanation/bg_explanation_01.png', size: 16757748 },
      bg_mencius: { path: 'WEN_24/dialogue/bg_mencius_01.png', size: 9915898 },
      bg_scroll: { path: 'WEN_24/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_24/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_Confucius: { path: 'WEN_24/dialogue/avatar_Confucius_02.png', size: 17303 },
      avatar_cao_gui: { path: 'WEN_24/dialogue/avatar_cao_gui_12.png', size: 1886154 },
      avatar_gongsun_chou: { path: 'WEN_24/dialogue/avatar_gongsun_chou_01.png', size: 1983573 },
      avatar_jingchun: { path: 'WEN_24/dialogue/avatar_jingchun_01.png', size: 1905519 },
      avatar_mencius: { path: 'WEN_24/dialogue/avatar_mencius_01.png', size: 1725882 },
      avatar_student: { path: 'WEN_24/dialogue/avatar_student_01.png', size: 1506734 },
      avatar_wanzhang: { path: 'WEN_24/dialogue/avatar_wanzhang_01.png', size: 1976232 },
    },
    characterCards: {
      card_character_cao_gui: {
        path: 'WEN_24/dialogue/card_character_cao_gui_12.png',
        size: 12129,
      },
      card_character_gongsun_chou: {
        path: 'WEN_24/dialogue/card_character_gongsun_chou_01.png',
        size: 15531,
      },
      card_character_jingchun: {
        path: 'WEN_24/dialogue/card_character_jingchun_01.png',
        size: 12945,
      },
      card_character_mencius: {
        path: 'WEN_24/dialogue/card_character_mencius_01.png',
        size: 10605,
      },
      card_character_student: {
        path: 'WEN_24/dialogue/card_character_student_01.png',
        size: 11880,
      },
      card_character_wanzhang: {
        path: 'WEN_24/dialogue/card_character_wanzhang_01.png',
        size: 12040,
      },
    },
    fileCount: 284,
  },
  WEN_25: {
    title: { path: 'WEN_25/summary/article_title_WEN_25.png', size: 25005 },
    roles: {
      btnBack: { path: 'WEN_25/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_25/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_25/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_25/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_25/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_25/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_25/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_25/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_25/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_25/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_25/quiz/option_a_01.png', size: 6298 },
      B: { path: 'WEN_25/quiz/option_b_01.png', size: 6298 },
      C: { path: 'WEN_25/quiz/option_c_01.png', size: 6334 },
      D: { path: 'WEN_25/quiz/option_d_01.png', size: 6334 },
    },
    textBoxes: {
      summary: { path: 'WEN_25/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_25/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_25/explanation/bg_explanation_01.png', size: 16757748 },
      bg_school: { path: 'WEN_25/dialogue/bg_school_01.png', size: 10476662 },
      bg_scroll: { path: 'WEN_25/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_25/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_student: { path: 'WEN_25/dialogue/avatar_student_01.png', size: 1302551 },
      avatar_teacher: { path: 'WEN_25/dialogue/avatar_teacher_01.png', size: 2407180 },
    },
    characterCards: {
      card_character_student: {
        path: 'WEN_25/dialogue/card_character_student_01.png',
        size: 11880,
      },
      card_character_teacher: {
        path: 'WEN_25/dialogue/card_character_teacher_01.png',
        size: 11275,
      },
    },
    fileCount: 203,
  },
  WEN_26: {
    title: { path: 'WEN_26/summary/article_title_WEN_26.png', size: 18538 },
    roles: {
      btnBack: { path: 'WEN_26/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_26/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_26/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_26/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_26/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_26/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_26/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_26/dialogue/card_bamboo_01.png', size: 288900 },
      bgScroll: { path: 'WEN_26/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_26/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_26/quiz/option_a_01.png', size: 6298 },
      B: { path: 'WEN_26/quiz/option_b_01.png', size: 6298 },
      C: { path: 'WEN_26/quiz/option_c_01.png', size: 6334 },
      D: { path: 'WEN_26/quiz/option_d_01.png', size: 6334 },
    },
    textBoxes: {
      summary: { path: 'WEN_26/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_26/video/article_bg_01.png', size: 16757748 },
      bg_city: { path: 'WEN_26/dialogue/bg_city_01.png', size: 10651209 },
      bg_explanation: { path: 'WEN_26/explanation/bg_explanation_01.png', size: 16757748 },
      bg_scroll: { path: 'WEN_26/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_26/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_squire: { path: 'WEN_26/dialogue/avatar_squire_01.png', size: 2054920 },
      avatar_villager: { path: 'WEN_26/dialogue/avatar_villager_01.png', size: 1766492 },
      avatar_youxuezhe: { path: 'WEN_26/dialogue/avatar_youxuezhe_01.png', size: 2303942 },
    },
    characterCards: {
      card_character_squire: { path: 'WEN_26/dialogue/card_character_squire_01.png', size: 13290 },
      card_character_villager: {
        path: 'WEN_26/dialogue/card_character_villager_01.png',
        size: 12196,
      },
      card_character_youxuezhe: {
        path: 'WEN_26/dialogue/card_character_youxuezhe_01.png',
        size: 16877,
      },
    },
    fileCount: 189,
  },
  WEN_27: {
    title: { path: 'WEN_27/explanation/article_title_WEN_27_01.png', size: 24000 },
    roles: {
      btnBack: { path: 'WEN_27/quiz/btn_back.png', size: 13676 },
      btnNext: { path: 'WEN_27/quiz/btn_next.png', size: 17303 },
      btnSubmit: { path: 'WEN_27/quiz/btn_submit_01.png', size: 22122 },
      btnCompleted: { path: 'WEN_27/dialogue/btn_completed.png', size: 19380 },
      bgm: { path: 'WEN_27/summary/bgm-controller.png', size: 61897 },
      gradeArea: { path: 'WEN_27/quiz/grade_area_01.png', size: 37861 },
      videoPlaceholder: { path: 'WEN_27/video/video_placeholder_01.png', size: 66427 },
      cardBamboo: { path: 'WEN_27/dialogue/card_bamboo_01.png', size: 378053 },
      bgScroll: { path: 'WEN_27/quiz/bg_scroll_01.png', size: 2898868 },
      bgSummary: { path: 'WEN_27/summary/bg_summary.png', size: 16757748 },
    },
    options: {
      A: { path: 'WEN_27/quiz/option_a_01.png', size: 6298 },
      B: { path: 'WEN_27/quiz/option_b_01.png', size: 6298 },
      C: { path: 'WEN_27/quiz/option_c_01.png', size: 6334 },
      D: { path: 'WEN_27/quiz/option_d_01.png', size: 6334 },
    },
    textBoxes: {
      summary: { path: 'WEN_27/summary/summary_text_box.png', size: 651551 },
    },
    backgrounds: {
      article_bg: { path: 'WEN_27/video/article_bg_01.png', size: 16757748 },
      bg_explanation: { path: 'WEN_27/explanation/bg_explanation_01.png', size: 16757748 },
      bg_fish: { path: 'WEN_27/dialogue/bg_fish_01.png', size: 4675100 },
      bg_scroll: { path: 'WEN_27/quiz/bg_scroll_01.png', size: 2898868 },
      bg_summary: { path: 'WEN_27/summary/bg_summary.png', size: 16757748 },
    },
    avatars: {
      avatar_mencius: { path: 'WEN_27/dialogue/avatar_mencius_01.png', size: 895853 },
      avatar_teenager: { path: 'WEN_27/dialogue/avatar_teenager_01.png', size: 1332237 },
    },
    characterCards: {
      card_character_mencius: {
        path: 'WEN_27/dialogue/card_character_mencius_01.png',
        size: 10605,
      },
      card_character_teenager: {
        path: 'WEN_27/dialogue/card_character_teenager_01.png',
        size: 18579,
      },
    },
    fileCount: 175,
  },
  WEN_28: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_29: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_30: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_31: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_32: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_33: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_34: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_35: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_36: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
  WEN_37: {
    title: undefined,
    roles: {},
    options: {},
    textBoxes: {},
    backgrounds: {},
    avatars: {},
    characterCards: {},
    fileCount: 0,
  },
}

/** 目录里已登记的篇目 ID（WEN_01 形式） */
export const FIGMA_SCREEN_CATALOG_WEN_IDS: readonly string[] = Object.freeze([
  'WEN_01',
  'WEN_02',
  'WEN_03',
  'WEN_04',
  'WEN_05',
  'WEN_06',
  'WEN_07',
  'WEN_08',
  'WEN_09',
  'WEN_10',
  'WEN_11',
  'WEN_12',
  'WEN_13',
  'WEN_14',
  'WEN_15',
  'WEN_16',
  'WEN_17',
  'WEN_18',
  'WEN_19',
  'WEN_20',
  'WEN_21',
  'WEN_22',
  'WEN_23',
  'WEN_24',
  'WEN_25',
  'WEN_26',
  'WEN_27',
  'WEN_28',
  'WEN_29',
  'WEN_30',
  'WEN_31',
  'WEN_32',
  'WEN_33',
  'WEN_34',
  'WEN_35',
  'WEN_36',
  'WEN_37',
])
