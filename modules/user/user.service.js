const { collections, ObjectId } = require('../../config/db');

const getUsers = async ({ page, limit, search }) => {
  const filter = {};

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, 'i');
    filter.$or = [{ displayName: searchRegex }, { email: searchRegex }];
  }

  const skip = (page - 1) * limit;

  const [users, totalUsers, riderUsers, adminUsers] = await Promise.all([
    collections.userCollection
      .find(filter, {
        projection: {
          email: 1,
          displayName: 1,
          photoURL: 1,
          role: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),

    collections.userCollection.countDocuments({}),
    collections.userCollection.countDocuments({ role: 'rider' }),
    collections.userCollection.countDocuments({ role: 'admin' }),
  ]);

  const totalPages = Math.max(Math.ceil(totalUsers / limit), 1);

  return {
    users,
    totalUsers,
    riderUsers,
    adminUsers,
    totalPages,
    currentPage: page,
    limit,
    search,
  };
};

const getUserByEmail = async (email) => {
  return await collections.userCollection.findOne({ email });
};

const getUserById = async (id) => {
  return await collections.userCollection.findOne(
    { _id: new ObjectId(id) },
    {
      projection: {
        email: 1,
        displayName: 1,
        photoURL: 1,
        role: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );
};

const createUser = async ({ email, displayName, photoURL }) => {
  const userExists = await collections.userCollection.findOne({ email });

  if (userExists) {
    // If user exists but displayName/photoURL was not populated yet (e.g. via self-healing), update it
    if ((!userExists.displayName && displayName) || (!userExists.photoURL && photoURL)) {
      await collections.userCollection.updateOne(
        { email },
        {
          $set: {
            ...(displayName && !userExists.displayName ? { displayName } : {}),
            ...(photoURL && !userExists.photoURL ? { photoURL } : {}),
            updatedAt: new Date(),
          },
        },
      );
    }
    return { alreadyExists: true };
  }

  const userData = {
    email,
    displayName: displayName || '',
    photoURL: photoURL || '',
    role: 'user',
    createdAt: new Date(),
  };

  const result = await collections.userCollection.insertOne(userData);
  return { alreadyExists: false, insertedId: result.insertedId };
};

const updateUserRole = async (id, role, decodedEmail) => {
  const targetUser = await collections.userCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!targetUser) {
    return { notFound: true };
  }

  if (targetUser.email === decodedEmail && role !== 'admin') {
    return { cannotDemoteSelf: true };
  }

  const result = await collections.userCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { role, updatedAt: new Date() } },
  );

  return { result };
};

module.exports = {
  getUsers,
  getUserByEmail,
  getUserById,
  createUser,
  updateUserRole,
};
