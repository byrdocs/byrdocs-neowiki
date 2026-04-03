import {visit} from "unist-util-visit";
let choicesIndex=0;
const toAlphaLabel=(n:number)=>{
	return String.fromCharCode(65+n);
};
const remark=(node)=>{
	if(node.type==="containerDirective"&&node.name==="choices"){
		const data=node.data??(node.data={});
		data.hName="div";
		data.hProperties={
			className:[
				"exam-choices",
				("multiple" in (node.attributes??{}))?"multiple":"single",
			],
			"data-answer":node.attributes?.answer??null,
		};
	}
};
const rehype=(node,index,parent)=>{
	const parseOptions=(node,multiple)=>{
		const choicesName=`choices-${choicesIndex++}`;
		if(node.children[0]?.tagName==="ul"){
			const children=node.children[0]?.children?.filter(child=>child.tagName==="li");
			const options=children.map((child,index)=>({
				type:"element",
				tagName:"label",
				properties:{
					className:["exam-choice-option"],
					"data-choice":toAlphaLabel(index),
				},
				children:[
					{
						type:"element",
						tagName:"input",
						properties:{
							className:["exam-choice-input"],
							type:multiple?"checkbox":"radio",
							value:toAlphaLabel(index),
							name:choicesName,
						},
					},
					{
						type:"element",
						tagName:"span",
						properties:{
							className:["exam-choice-indicator"],
						},
					},
					{
						type:"element",
						tagName:"span",
						properties:{
							className:["exam-choice-letter"],
						},
						children:[
							{
								type:"text",
								value:` ${toAlphaLabel(index)}. `,
							},
						],
					},
					{
						type:"element",
						tagName:"span",
						properties:{
							className:["exam-choice-content"],
						},
						children:child.children??null,
					},
				],
			}));
			return options;
		}
	};
	if(node.tagName==="div"&&node.properties.className?.includes("exam-choices")){
		const multiple=node.properties.className?.includes("multiple");
		console.log(multiple);
		parent.children[index]={
			type:"element",
			tagName:"fieldset",
			properties:{
				className:node.properties.className,
				"data-answer":node.properties["data-answer"],
			},
			children:[
				{
					type:"element",
					tagName:"div",
					properties:{
						className:["exam-choices-options"],
					},
					children:parseOptions(node,multiple),
				},
				{
					type:"element",
					tagName:"button",
					properties:{
						className:["exam-choices-submit"],
					},
					children:[
						{
							type:"text",
							value:"检查",
						},
					],
				},
			],
		};
	}
};
export function remarkChoices(){
	return (tree)=>{
		visit(tree,remark);
	};
}
export function rehypeChoices(){
	return (tree)=>{
		visit(tree,rehype);
	};
}
