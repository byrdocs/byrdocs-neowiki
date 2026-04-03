const fieldsets=document.querySelectorAll(".exam-choices");
fieldsets.forEach(fieldset=>{
	const button=fieldset.querySelector(".exam-choices-submit");
	button.addEventListener("click",()=>{
		const answerSet=new Set(fieldset.getAttribute("data-answer"));
		let allCorrect=true;
		for(const choice of fieldset.querySelectorAll(".exam-choice-option")){
			const value=choice.getAttribute("data-choice");
			const isAnswer=answerSet.has(value);
			const input=choice.querySelector(".exam-choice-input");
			const isSelected=input.checked;
			choice.classList.remove("is-correct","is-wrong","is-missed");
			if(isAnswer){
				if(isSelected){
					choice.classList.add("is-correct");
				}
				else{
					choice.classList.add("is-missed");
					allCorrect=false;
				}
			}
			else{
				if(isSelected){
					choice.classList.add("is-wrong");
					allCorrect=false;
				}
			}
		}
		button.classList.remove("is-all-correct","is-not-all-correct");
		if(allCorrect){
			button.classList.add("is-all-correct");
		}
		else{
			button.classList.add("is-not-all-correct");
		}
	});
});
