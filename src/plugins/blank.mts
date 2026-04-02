import {visit} from "unist-util-visit";
const remark=(node)=>{
	if(node.type==="textDirective"&&node.name==="blank"){
		const data=node.data??(node.data={});
		data.hName="span";
		data.hProperties={
			className:["exam-blank"],
		};
	}
};
export function remarkBlank(){
	return (tree)=>{
		visit(tree,remark);
	};
}
const rehype=(node,index,parent)=>{
	if(node.tagName==="span"&&node.properties.className?.includes("exam-blank")){
		const hasAnswer=node.children?.length>0||false;
		parent.children[index]={
			type:"element",
			tagName:"button",
			properties:{
				type:"button",
				className:["exam-blank"],
				"aria-expanded":"false",
				disabled:!hasAnswer,
			},
			children:[
				{
					type:"element",
					tagName:"span",
					properties:{
						className:["exam-blank-placeholder"],
					},
					children:[
						{
							type:"text",
							value:hasAnswer?"【显示答案】":"【暂无答案】",
						},
					],
				},
				{
					type:"element",
					tagName:"span",
					properties:{
						className:["exam-blank-answer"],
					},
					children:node.children,
				},
			],
		};
	}
};
export function rehypeBlank(){
	return (tree)=>{
		visit(tree,"element",rehype);
	}
}
