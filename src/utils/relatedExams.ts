import type { CollectionEntry } from "astro:content";

interface MetadataItem {
  id: string;
  url: string;
  type: string;
  data: {
    course: {
      name: string;
    };
    time: {
      start: string;
      end: string;
      semester: string | null;
      stage: string | null;
    };
  };
}

export interface RelatedExam {
  id: string;
  title: string;
  url: string;
  isWiki: boolean;
  isCurrent: boolean;
  sortKey: number;
}

const timePattern = /^(\d{4})-(\d{4})学年第([一二])学期$/;

const getWikiSortKey = (time: string): number => {
  const match = time.match(timePattern);
  if (!match) return 0;
  const startYear = Number(match[1]);
  const semester = match[3] === "一" ? 1 : 2;
  return startYear * 10 + semester;
};

const getMetaSortKey = (start: string, semester: string | null): number => {
  const sem = semester === "First" ? 1 : semester === "Second" ? 2 : 0;
  return Number(start) * 10 + sem;
};

export async function fetchMetadata(): Promise<MetadataItem[]> {
  try {
    const response = await fetch("https://byrdocs.org/data/metadata.json");
    if (!response.ok) {
      console.warn(
        `Failed to fetch metadata: ${response.status} ${response.statusText}`
      );
      return [];
    }
    const data = await response.json();
    return data.filter(
      (item: MetadataItem) =>
        item.type === "test" &&
        item.data?.time?.stage &&
        item.data?.course?.name
    );
  } catch (error) {
    console.warn("Failed to fetch metadata:", error);
    return [];
  }
}

export function buildRelatedExams(
  currentExam: CollectionEntry<"exams">,
  allWikiExams: CollectionEntry<"exams">[],
  metadata: MetadataItem[]
): RelatedExam[] {
  const currentSubject = currentExam.data.科目;
  const currentStage = currentExam.data.阶段;
  const currentSource = currentExam.data.来源;

  // Build a set of wiki source IDs for quick lookup
  const wikiSourceMap = new Map<string, CollectionEntry<"exams">>();
  for (const exam of allWikiExams) {
    if (exam.data.来源) {
      wikiSourceMap.set(exam.data.来源, exam);
    }
  }

  const relatedExams: RelatedExam[] = [];

  // Add wiki exams with same subject and stage, including the current page.
  for (const exam of allWikiExams) {
    if (
      exam.data.科目 === currentSubject &&
      exam.data.阶段 === currentStage
    ) {
      relatedExams.push({
        id: exam.id,
        title: exam.id,
        url: `/exam/${exam.id}`,
        isWiki: true,
        isCurrent: exam.id === currentExam.id,
        sortKey: getWikiSortKey(exam.data.时间),
      });
    }
  }

  // Add metadata exams with same subject and stage that are NOT represented in wiki.
  for (const item of metadata) {
    const isCurrentSource = Boolean(currentSource && item.id === currentSource);
    const isRepresentedByCurrentPage =
      isCurrentSource && wikiSourceMap.get(item.id)?.id === currentExam.id;

    if (
      item.data.course.name === currentSubject &&
      item.data.time.stage === currentStage &&
      !isRepresentedByCurrentPage &&
      (isCurrentSource || !wikiSourceMap.has(item.id))
    ) {
      const semester = item.data.time.semester;
      const sem =
        semester === "First" ? "1" :
        semester === "Second" ? "2" : "";
      const startShort = item.data.time.start.slice(2);
      const endShort = item.data.time.end.slice(2);
      const timePart = sem
        ? `${startShort}-${endShort}-${sem}`
        : `${startShort}-${endShort}`;
      const title = `${timePart}-${currentSubject}-${currentStage}`;

      relatedExams.push({
        id: item.id,
        title,
        url: `https://byrdocs.org/?c=test&q=${item.id}`,
        isWiki: false,
        isCurrent: isCurrentSource,
        sortKey: getMetaSortKey(item.data.time.start, item.data.time.semester),
      });
    }
  }

  // Sort by sortKey descending (newest first)
  relatedExams.sort((a, b) => b.sortKey - a.sortKey);

  return relatedExams;
}
