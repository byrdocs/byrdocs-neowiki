import {visit} from "unist-util-visit";
const transformer=(node,index,parent)=>{
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
export default function rehypeFigure(){
	return (tree)=>{
		visit(tree,"element",transformer);
	};
}
