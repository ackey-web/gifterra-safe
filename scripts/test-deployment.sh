#!/bin/bash

# Test Deployment Script
# Tests complete factory deployment on local Hardhat network

set -e  # Exit on error

echo "=========================================="
echo "Gifterra Factory Deployment Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Hardhat compilation
echo -e "${YELLOW}Step 1: Checking Hardhat compilation...${NC}"
npx hardhat compile
echo -e "${GREEN}✅ Compilation successful${NC}"
echo ""

# Step 2: Start local Hardhat node in background
echo -e "${YELLOW}Step 2: Starting local Hardhat node...${NC}"
npx hardhat node > /tmp/hardhat-node.log 2>&1 &
HARDHAT_PID=$!
echo "Hardhat node started with PID: $HARDHAT_PID"
sleep 3  # Wait for node to start
echo -e "${GREEN}✅ Hardhat node running${NC}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    kill $HARDHAT_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Step 3: Deploy contracts
echo -e "${YELLOW}Step 3: Deploying RankPlanRegistry + GifterraFactory...${NC}"
npx hardhat run scripts/deploy-complete-factory.js --network localhost
echo -e "${GREEN}✅ Deployment successful${NC}"
echo ""

# Step 4: Check deployment files
echo -e "${YELLOW}Step 4: Checking deployment files...${NC}"
LATEST_DEPLOYMENT=$(ls -t deployments/complete-factory-localhost-*.json 2>/dev/null | head -1)

if [ -f "$LATEST_DEPLOYMENT" ]; then
    echo "Latest deployment file: $LATEST_DEPLOYMENT"
    echo ""
    echo "Deployment Summary:"
    cat "$LATEST_DEPLOYMENT" | grep -A 20 '"contracts"'
    echo -e "${GREEN}✅ Deployment file created${NC}"
else
    echo -e "\033[0;31m❌ Deployment file not found${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo -e "${GREEN}All tests passed! ✅${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review deployment file: $LATEST_DEPLOYMENT"
echo "2. Test tenant creation: npx hardhat run scripts/create-tenant.js --network localhost"
echo "3. Deploy to Polygon Amoy testnet when ready"
echo ""
