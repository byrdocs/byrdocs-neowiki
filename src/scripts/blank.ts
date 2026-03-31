const blanks=document.querySelectorAll(".exam-blank");
blanks.forEach(blank=>{
	const placeholder=blank.querySelector(":scope > .exam-blank-placeholder");
	const answer=blank.querySelector(":scope > .exam-blank-answer");
	placeholder.hidden=false;
	answer.hidden=true;
	blank.addEventListener("click",()=>{
		if(placeholder&&answer){
			const isExpanded=blank.getAttribute("aria-expanded")==="true";
			blank.setAttribute("aria-expanded",`${!isExpanded}`);
			placeholder.hidden=!isExpanded;
			answer.hidden=isExpanded;
		}
	});
});
