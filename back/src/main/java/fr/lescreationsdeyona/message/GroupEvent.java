package fr.lescreationsdeyona.message;

/**
 * What a member changed in a group (2.13), written in its conversation as a line of its own, as a chat
 * does: "Léa a ajouté Sam". And, written by the site itself in the group of all the admins, a new version
 * of the application (VERSION, 2.14, see VersionAnnouncement). Each told on the devices of the members, as a
 * message (2.18, MessagePush). The value of the line: the name given
 * (CREATED, RENAMED), the member concerned (ADDED, REMOVED), the version (VERSION), none otherwise.
 */
public enum GroupEvent {

	CREATED, RENAMED, PHOTO_CHANGED, PHOTO_REMOVED, ADDED, REMOVED, LEFT, VERSION

}
