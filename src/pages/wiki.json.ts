import type {APIRoute} from "astro";
import {getCollection} from "astro:content";
export const GET:APIRoute=async ()=>{
	const parseMetadata=(exam=>{
		const type="test";
		const id=exam.data.来源??undefined;
		const url=`https://wiki.byrdocs.org/exam/${exam.id}`;
		const college=exam.data.学院??undefined;
		const course={
			type:exam.data.类型,
			name:exam.data.科目,
		};
		const filetype="wiki";
		const time={
			start:exam.data.时间.slice(0,4),
			end:exam.data.时间.slice(5,9),
			semester:exam.data.时间.slice(12,13)==="一"?"First":"Second",
			stage:exam.data.阶段,
		};
		const content=[
			"原题",
			...((exam.data.答案完成度==="完整"||exam.data.答案完成度==="完整可靠")?["答案"]:[]),
		];
		return {
			type,
			id,
			data:{
				college,
				course,
				filetype,
				time,
				content,
			},
			url,
		};
	});
	const exams=await getCollection("exams");
	const result=exams.map(exam=>parseMetadata(exam));
	return Response.json(result);
};
