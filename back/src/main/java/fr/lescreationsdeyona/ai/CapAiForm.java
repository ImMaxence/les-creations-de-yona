package fr.lescreationsdeyona.ai;

/**
 * The shape asked for an article written by the AI, as the models of "Nouvel article": a story, a
 * step by step, a notebook; or the one that fits the notes best.
 */
public enum CapAiForm {

	AUTO("Choisis la forme qui va le mieux aux notes."),
	STORY("Forme demandée : un récit (une journée, un examen). Un TEXT, une IMAGE, puis un ou deux TEXT."),
	STEPS("Forme demandée : un pas à pas (une réalisation). Un TEXT d'introduction, un STEPS, puis un TIP si les notes "
			+ "donnent une astuce ou un piège."),
	NOTEBOOK("Forme demandée : un carnet (plusieurs remarques). Un TEXT d'introduction, puis un IMAGE_TEXT par remarque.");

	/** What the model is told, in French. */
	final String instruction;

	CapAiForm(String instruction) {
		this.instruction = instruction;
	}

}
