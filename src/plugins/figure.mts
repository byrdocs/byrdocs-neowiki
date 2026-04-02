import {visit} from "unist-util-visit";
const remark=(node)=>{
	if(node.type==="leafDirective"&&node.name==="figure"){
		const data=node.data??(node.data={});
		data.hName="div";
		const className=["exam-figure"];
		if("float" in (node.attributes??{})){
			className.push("exam-figure-float");
		}
		if(node.attributes?.src.endsWith(".svg")){
			className.push("exam-figure-svg");
		}
		data.hProperties={
			className,
			src:node.attributes?.src,
		};
	}
};
export function remarkFigure(){
	return (tree)=>{
		visit(tree,remark);
	};
}
import {visit} from "unist-util-visit";
const rehype=(node,index,parent)=>{
	if(node.tagName==="div"&&node.properties.className?.includes("exam-figure")){
		const img=node.properties.src;
		parent.children[index]={
			type:"element",
			tagName:"figure",
			properties:{
				className:node.properties.className,
			},
			children:[
				{
					type:"element",
					tagName:"image",
					properties:{
						src:`/${img}`,
						alt:img,
						loading:"lazy",
						className:["exam-figure-image"],
					},
				},
				node.children[0]?{
					type:"element",
					tagName:"figcaption",
					properties:{
						className:["exam-figure-caption"],
					},
					children:node.children,
				}:{},
			],
		};
	}
};
export function rehypeFigure(){
	return (tree)=>{
		visit(tree,"element",rehype);
	};
}
