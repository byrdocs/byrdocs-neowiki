import {visit} from "unist-util-visit";
const remark=(node)=>{
	if(node.type==="containerDirective"&&node.name==="solution"){
		const data=node.data??(node.data={});
		data.hName="div";
		data.hProperties={
			className:["exam-solution"],
		};
	}
};
export function remarkSolution(){
	return (tree)=>{
		visit(tree,remark);
	};
}
const rehype=(node,index,parent)=>{
	if(node.tagName==="div"&&node.properties.className?.includes("exam-solution")){
		parent.children[index]={
			type:"element",
			tagName:"details",
			properties:{
				type:"details",
				className:["exam-solution"],
			},
			children:[
				{
					type:"element",
					tagName:"summary",
					properties:{
						className:["exam-solution-summary"],
					},
					children:[
						{
							type:"text",
							value:"答案",
						},
					],
				},
				{
					type:"element",
					tagName:"div",
					properties:{
						className:["exam-solution-content"],
					},
					children:node.children,
				},
			],
		};
	}
};
export function rehypeSolution(){
	return (tree)=>{
		visit(tree,"element",rehype);
	}
}
