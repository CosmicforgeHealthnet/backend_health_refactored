function publicUser(user) {
    if (!user) return undefined;
    return {
        id: user.id,
        fullName: user.fullName,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
    };
}

function formatCommunity(community) {
    if (!community) return undefined;
    const { chatRoom, ...rest } = community;
    return { ...rest, createdBy: publicUser(community.createdBy), chatRoomId: chatRoom?.id ?? null };
}

function formatMember(member) {
    if (!member) return undefined;
    return {
        id: member.id,
        role: member.role,
        isActive: member.isActive,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
        user: publicUser(member.user),
    };
}

function formatPost(post) {
    if (!post) return undefined;
    const { deletedBy, community, ...rest } = post;
    return {
        ...rest,
        author: publicUser(post.author),
        community: community ? { id: community.id, name: community.name } : undefined,
    };
}

function formatComment(comment) {
    if (!comment) return undefined;
    return { ...comment, author: publicUser(comment.author) };
}

function formatJoinRequest(request) {
    if (!request) return undefined;
    return { ...request, user: publicUser(request.user), reviewedBy: publicUser(request.reviewedBy) };
}

function formatSave(save) {
    if (!save) return undefined;
    return { ...save, post: formatPost(save.post) };
}

function formatEvent(event) {
    if (!event) return undefined;
    const { community, ...rest } = event;
    return {
        ...rest,
        createdBy: publicUser(event.createdBy),
        community: community ? { id: community.id, name: community.name } : undefined,
    };
}

function formatRsvp(rsvp) {
    if (!rsvp) return undefined;
    return {
        id: rsvp.id,
        remindMe: rsvp.remindMe,
        createdAt: rsvp.createdAt,
        user: publicUser(rsvp.user),
    };
}

// hostStartUrl gives full Zoom host/moderator control over the meeting — it must
// only ever reach the space's actual host, never any other viewer.
function formatVoiceSpace(space, viewerId) {
    if (!space) return undefined;
    const isHost = !!viewerId && space.host?.id === viewerId;
    const { hostStartUrl, ...rest } = space;
    return { ...rest, host: publicUser(space.host), hostStartUrl: isHost ? hostStartUrl : undefined };
}

function formatVoiceSpaceParticipant(participant) {
    if (!participant) return undefined;
    return {
        id: participant.id,
        role: participant.role,
        handRaised: participant.handRaised,
        isActive: participant.isActive,
        joinedAt: participant.joinedAt,
        user: publicUser(participant.user),
    };
}

function formatInvite(invite) {
    if (!invite) return undefined;
    return {
        id:          invite.id,
        status:      invite.status,
        message:     invite.message,
        respondedAt: invite.respondedAt,
        createdAt:   invite.createdAt,
        community:   invite.community ? { id: invite.community.id, name: invite.community.name } : undefined,
        invitedBy:   publicUser(invite.invitedBy),
        invitee:     publicUser(invite.invitee),
    };
}

module.exports = {
    publicUser,
    formatCommunity,
    formatMember,
    formatPost,
    formatComment,
    formatJoinRequest,
    formatSave,
    formatEvent,
    formatRsvp,
    formatVoiceSpace,
    formatVoiceSpaceParticipant,
    formatInvite,
};
