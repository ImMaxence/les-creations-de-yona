package fr.lescreationsdeyona.message;

/**
 * What a member changed in a group (2.13), written in its conversation as a line of its own, as a chat
 * does: "Léa a ajouté Sam". The value of the line: the name given (CREATED, RENAMED), the member concerned
 * (ADDED, REMOVED), none otherwise.
 */
public enum GroupEvent {

	CREATED, RENAMED, PHOTO_CHANGED, PHOTO_REMOVED, ADDED, REMOVED, LEFT

}
