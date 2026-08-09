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
    return { ...community, createdBy: publicUser(community.createdBy) };
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
    const { deletedBy, ...rest } = post;
    return { ...rest, author: publicUser(post.author) };
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

module.exports = { publicUser, formatCommunity, formatMember, formatPost, formatComment, formatJoinRequest, formatSave };
