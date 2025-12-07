#!/bin/bash

# Script to create a new release: bump version, commit, tag, and push

set -e  # Exit on error

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Split version into parts
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Increment patch version
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

echo "🚀 Creating new release"
echo "Current version: $CURRENT_VERSION"
echo "New version: $NEW_VERSION"
echo ""

# Update package.json
echo "📝 Updating package.json..."
npm version $NEW_VERSION --no-git-tag-version

# Update meson.build
echo "📝 Updating meson.build..."
sed -i "s/version: '$CURRENT_VERSION'/version: '$NEW_VERSION'/" meson.build

# Update debian/changelog
echo "📝 Updating debian/changelog..."
CURRENT_DATE=$(date -R)
AUTHOR_NAME="Jose Francisco Gonzalez"
AUTHOR_EMAIL="jfgs1609@gmail.com"

cat > debian/changelog.tmp << EOF
obision-system ($NEW_VERSION) unstable; urgency=medium

  * Release version $NEW_VERSION

 -- $AUTHOR_NAME <$AUTHOR_EMAIL>  $CURRENT_DATE

EOF

cat debian/changelog >> debian/changelog.tmp
mv debian/changelog.tmp debian/changelog

# Commit changes
echo "💾 Committing changes..."
git add package.json meson.build debian/changelog package-lock.json CHANGELOG.md
git commit -m "Release version $NEW_VERSION"

# Create tag
echo "🏷️  Creating tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"

# Push to repository
echo "⬆️  Pushing to repository..."
git push origin master
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Release $NEW_VERSION created successfully!"
echo ""
echo "To build the .deb package locally, run:"
echo "  npm run deb-build"
echo ""
echo "Check the repository at: https://github.com/nirlob/obision-system"
