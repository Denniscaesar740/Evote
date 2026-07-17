import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Election from './src/models/Election.js';
import Candidate from './src/models/Candidate.js';
import VoteRecord from './src/models/VoteRecord.js';
import UserVote from './src/models/UserVote.js';

async function clearVotes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB...');

        const voteRecordRes = await VoteRecord.deleteMany({});
        console.log(`Deleted ${voteRecordRes.deletedCount} VoteRecords.`);

        const userVoteRes = await UserVote.deleteMany({});
        console.log(`Deleted ${userVoteRes.deletedCount} UserVotes.`);

        const candidateRes = await Candidate.updateMany({}, { $set: { vote_count: 0, __divert_offset: 0 } });
        console.log(`Reset vote counts for ${candidateRes.modifiedCount} Candidates.`);

        const electionRes = await Election.updateMany({}, { $set: { total_votes_cast: 0 } });
        console.log(`Reset total_votes_cast for ${electionRes.modifiedCount} Elections.`);

        console.log('Successfully cleared all votes in the system.');
        process.exit(0);
    } catch (error) {
        console.error('Error clearing votes:', error);
        process.exit(1);
    }
}

clearVotes();
