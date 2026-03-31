import {visit} from "unist-util-visit";
const transformer=(node)=>{
	if(node.type==="containerDirective"&&node.name==="solution"){
		const data=node.data||(node.data={});
		data.hName="span";
		data.hProperties={
			className:["exam-solution"],
		}
	}
};
export default function remarkSolution(){
	return (tree)=>{
		visit(tree,transformer);
	};
}
