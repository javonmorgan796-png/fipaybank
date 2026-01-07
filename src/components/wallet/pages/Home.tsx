// BalanceCard.tsx - example
interface BalanceCardProps {
  balance: number;
}

const BalanceCard = ({ balance }: BalanceCardProps) => {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
      <p className="text-sm opacity-90">Current Balance</p>
      <p className="text-4xl font-bold mt-2">${balance?.toFixed(2) || "0.00"}</p>
      <div className="mt-4 flex items-center text-sm opacity-90">
        <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
        Account Active
      </div>
    </div>
  );
};

export default BalanceCard;
