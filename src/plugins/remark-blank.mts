import {visit} from "unist-util-visit";
const transformer=(node)=>{
	if(node.type==="textDirective"&&node.name==="blank"){
		const data=node.data||(node.data={});
		data.hName="span";
		data.hProperties={
			className:["exam-blank"],
			"data-exam-blank":"",
		};
	}
};
export default function remarkBlank(){
	return (tree)=>{
		visit(tree,transformer);
	};
}
