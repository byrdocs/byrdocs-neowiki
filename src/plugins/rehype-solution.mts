import {visit} from "unist-util-visit";
const transformer=(node,index,parent)=>{
	if(node.tagName==="span"&&node.properties.className?.includes("exam-solution")){
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
export default function rehypeSolution(){
	return (tree)=>{
		visit(tree,"element",transformer);
	}
}
