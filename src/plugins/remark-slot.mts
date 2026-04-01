import {visit} from "unist-util-visit";
const transformer=(node)=>{
	if(node.type==="textDirective"&&node.name==="slot"){
		if(node.children[0]){
			node.children[0].value=`( ${children.value} )`;
		}
		else{
			node.children.push({
				type:"text",
				value:"(  )",
			});
		}
		const data=node.data??(node.data={});
		data.hName="span";
		data.hProperties={
			className:["exam-slot"],
		};
	}
};
export default function remarkSlot(){
	return (tree)=>{
		visit(tree,transformer);
	};
}
