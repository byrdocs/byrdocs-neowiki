import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";

const timePattern = /^(\d{4})-(\d{4})学年第([一二])学期$/;

const parseMetadata = (exam: CollectionEntry<"exams">) => {
    const timeMatch = exam.data.时间.match(timePattern);

    if (!timeMatch) {
        throw new Error(`Unexpected exam time format: ${exam.data.时间}`);
    }

    const [, start, end, semester] = timeMatch;
    const hasAnswers =
        exam.data.答案完成度 === "完整" || exam.data.答案完成度 === "完整可靠";

    return {
        type: "test" as const,
        id: exam.data.来源,
        data: {
            college: exam.data.学院,
            course: {
                type: exam.data.类型,
                name: exam.data.科目,
            },
            filetype: "wiki" as const,
            time: {
                start,
                end,
                semester: semester === "一" ? "First" : "Second",
                stage: exam.data.阶段,
            },
            content: hasAnswers ? ["原题", "答案"] : ["原题"],
        },
        url: `https://wiki.byrdocs.org/w/${exam.id}`,
    };
};

export const GET: APIRoute = async () => {
    const exams = await getCollection("exams");
    return Response.json(exams.map(parseMetadata));
};
