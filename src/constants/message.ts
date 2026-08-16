export const SUCCESS_MESSAGE = {
  REGISTERED: 'Account created successfully',
  LOGGED_IN: 'Logged in successfully',
  PROFILE_FETCHED: 'Profile fetched successfully',
  TOOL_SUBMITTED: 'Tool submitted successfully',
  TOOL_FETCHED: 'Tool fetched successfully',
  TOOLS_FETCHED: 'Tools fetched successfully',
  RECENT_TOOLS_FETCHED: 'Recently added tools fetched successfully',
  POPULAR_TOOLS_FETCHED: 'Popular tools fetched successfully',
  RELATED_TOOLS_FETCHED: 'Related tools fetched successfully',
  UPVOTED: 'Tool upvoted successfully',
  UPVOTE_REMOVED: 'Upvote removed successfully',
  CATEGORIES_FETCHED: 'Categories fetched successfully',
} as const;

export const ERROR_MESSAGE = {
  INVALID_ID: 'Invalid id provided',
  TOOL_NOT_FOUND: 'Tool not found',
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  NO_TOKEN_PROVIDED: 'No token provided — access denied',
  INVALID_EXPIRED_TOKEN: 'Invalid or expired token',
  ALREADY_UPVOTED: 'You have already upvoted this tool',
  NOT_UPVOTED: 'You have not upvoted this tool',
  TOOL_ALREADY_EXISTS: 'A tool with this link has already been submitted',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our end',
} as const;
