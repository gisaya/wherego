const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'data', 'source-question-blueprint.json');
const generalPath = path.join(root, 'data', 'general-question-bank.json');
const outputPath = path.join(root, 'docs', 'wherego-option-expansion-context.json');

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const general = JSON.parse(fs.readFileSync(generalPath, 'utf8'));

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value).trim()).filter(Boolean))];
}

function compactOption(option) {
  return {
    sourceId: option.sourceId || '',
    label: option.label || '',
    tags: uniqueStrings(option.tags),
    searchHints: uniqueStrings(option.searchHints),
    constraints: option.constraints || {},
  };
}

function optionCatalog(group) {
  const options = new Map();
  for (const question of group.questions || []) {
    for (const option of question.options || []) {
      const key = option.sourceId || `${option.label}|${JSON.stringify(option.tags || [])}`;
      if (!options.has(key)) {
        options.set(key, compactOption(option));
      }
    }
  }
  return [...options.values()];
}

function questionSamples(group) {
  const binary = (group.questions || []).filter((question) => question.type === 'select_2').slice(0, 3);
  const four = (group.questions || []).filter((question) => question.type === 'select_4').slice(0, 3);
  return [...binary, ...four].map((question) => ({
    id: question.id,
    type: question.type,
    question: question.question,
    optionSourceIds: (question.options || []).map((option) => option.sourceId || ''),
    optionLabels: (question.options || []).map((option) => option.label || ''),
  }));
}

const constraintKeys = new Set();
for (const axis of source.requiredAxes || []) {
  for (const variant of axis.variants || []) {
    for (const option of variant.options || []) {
      Object.keys(option.constraints || {}).forEach((key) => constraintKeys.add(key));
    }
  }
}
for (const group of general.tagGroups || []) {
  for (const option of optionCatalog(group)) {
    Object.keys(option.constraints || {}).forEach((key) => constraintKeys.add(key));
  }
}

const context = {
  version: '2026-07-12',
  appName: '어디고',
  purpose: '다른 AI가 현재 질문은행과 겹치지 않는 여행지 추천용 선택지 후보를 제안하도록 제공하는 검토 컨텍스트',
  productPrinciple: '성격 테스트가 아니라 실제로 갈 관광지를 좁히는 질문이어야 한다.',
  dataSources: ['한국관광공사 국문 관광정보 서비스 KorService2', '한국관광공사 지역별 방문자수 DataLabService'],
  currentRuntime: {
    totalQuestions: 7,
    sourceQuestions: 3,
    generalQuestions: 4,
    sourceAxisRule: 'movement_scope, party_constraints, destination_intent 축에서 각각 1개를 무작위 출제한다.',
    generalRule: general.runtimeSelection.rule,
    requiredTagGroups: general.runtimeSelection.requiredTagGroups,
    oneOfTagGroups: general.runtimeSelection.oneOfTagGroups,
    mutuallyExclusiveTagGroups: general.runtimeSelection.mutuallyExclusiveTagGroups,
    sourceQuestionConflicts: general.runtimeSelection.sourceQuestionConflicts,
    destinationSpecificTagGroups: [
      'activity',
      'culture_style',
      'healing_energy',
      'landscape',
      'outdoor_stay',
      'photo',
      'season',
      'weather',
    ],
  },
  expansionRules: {
    focus: '생성된 질문 420개를 직접 늘리지 말고 태그별 원천 선택지를 보강한다.',
    optionLabelMaxCharacters: 16,
    searchHintCount: '2~4개',
    tagCount: '1~4개',
    binaryRule: '2지선다의 두 선택지는 의미가 겹치지 않고 사용자가 고민 없이 구분할 수 있어야 한다.',
    fourChoiceRule: '4지선다의 네 선택지는 같은 분류 축에서 상호 구분되어야 한다.',
    destinationRule: '선택 결과가 관광지 유형, 검색어, 거리/지역, 접근성, 날씨 대응, 혼잡도 중 하나를 실제로 바꿔야 한다.',
    avoid: [
      '성격 유형만 설명하고 관광지 검색을 바꾸지 않는 선택지',
      '이미 similarOptionGroups에 묶인 선택지와 사실상 같은 선택지',
      '맛집/카페 자체가 목적지가 되어 여행지 추천 철학을 흐리는 선택지',
      '검색할 수 없는 추상어만 있는 searchHints',
      '형님, 내부 기획 용어, API, 데이터, 점수 같은 사용자 비노출 표현',
      '기존 sourceId 재사용 또는 기존 label의 단순 어순 변경',
    ],
    allowedExistingConstraintKeys: [...constraintKeys].sort(),
    newConstraintPolicy: '새 constraint가 꼭 필요하면 이름, 타입, 서버 필터/가중치 적용 방식을 함께 설명한다.',
  },
  expectedResponse: {
    format: 'JSON only',
    generalOptionAdditions: '기존 tagGroup별로 실제 빈틈이 있을 때만 2~5개 제안한다.',
    sourceAxisAdditions: '원천축별로 필요할 때만 질문 variant를 최대 2개 제안한다.',
    newTagGroupProposals: '기존 14개 그룹으로 표현할 수 없는 목적지 구분 축만 최대 3개 제안한다.',
    requiredChecks: ['기존 중복', '의미 중복', '관광공사 검색 가능성', '사용자 문구 길이', '필터 또는 가중치 연결'],
  },
  sourceAxes: (source.requiredAxes || []).map((axis) => ({
    axis: axis.axis,
    label: axis.label,
    why: axis.why,
    variantCount: (axis.variants || []).length,
    variants: axis.variants,
  })),
  generalTagGroups: (general.tagGroups || []).map((group) => ({
    tagGroup: group.tagGroup,
    label: group.label,
    why: group.why,
    questionCount: (group.questions || []).length,
    select2Count: (group.questions || []).filter((question) => question.type === 'select_2').length,
    select4Count: (group.questions || []).filter((question) => question.type === 'select_4').length,
    existingOptionCatalog: optionCatalog(group),
    semanticDuplicateGroups: general.runtimeSelection.similarOptionGroups?.[group.tagGroup] || [],
    questionSamples: questionSamples(group),
  })),
  responseSchema: {
    summary: ['string'],
    generalOptionAdditions: [
      {
        tagGroup: 'existing_tag_group',
        gap: 'string',
        options: [
          {
            sourceId: 'snake_case_unique_id',
            label: '16자 이내 한국어',
            tags: ['tag'],
            searchHints: ['관광공사 검색 가능한 명사'],
            constraints: {},
            destinationImpact: '후보 검색/필터/점수에 주는 영향',
            contrastWith: ['기존 sourceId'],
          },
        ],
      },
    ],
    sourceAxisAdditions: [
      {
        axis: 'movement_scope | party_constraints | destination_intent',
        rationale: 'string',
        variants: [
          {
            id: 'unique_id',
            type: 'select_2 | select_4',
            mode: 'string',
            question: '짧은 한국어 질문',
            options: ['same option shape as above'],
          },
        ],
      },
    ],
    newTagGroupProposals: [
      {
        tagGroup: 'snake_case',
        label: '한국어',
        whyNeeded: '기존 그룹으로 대체 불가능한 이유',
        ktoConnection: '검색어/콘텐츠 유형/분류 연결',
        sourceOptions: ['same option shape as above'],
        sampleQuestions: ['select_2와 select_4 예시'],
      },
    ],
    duplicateOrMergeWarnings: [{ existingSourceIds: ['id'], reason: 'string' }],
    rejectedIdeas: [{ idea: 'string', reason: 'string' }],
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
console.log(`Built ${path.relative(root, outputPath)}`);
