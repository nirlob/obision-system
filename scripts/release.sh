#!/bin/bash

# Script to create a new release: bump version, commit, tag, push, build .deb and update obision-packages

set -e  # Exit on error

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Split version into parts
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Increment minor version and reset patch
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="${MAJOR}.${NEW_MINOR}.0"

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
obision-app-system ($NEW_VERSION) unstable; urgency=medium

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
echo "📦 Building .deb package..."
npm run deb-build

# Check if .deb was created
if [ ! -f "builddir/obision-app-system.deb" ]; then
    echo "❌ Error: .deb package not created"
    exit 1
fi

echo "✅ .deb package created successfully"

# Copy .deb to obision-packages/debs
echo "📋 Copying .deb to ../obision-packages/debs..."
PACKAGES_DIR="../obision-packages"
DEBS_DIR="$PACKAGES_DIR/debs"

if [ ! -d "$PACKAGES_DIR" ]; then
    echo "❌ Error: obision-packages directory not found at $PACKAGES_DIR"
    exit 1
fi

# Create debs directory if it doesn't exist
mkdir -p "$DEBS_DIR"

# Remove old versions of obision-app-system
echo "🗑️  Removing old versions..."
rm -f "$DEBS_DIR"/obision-app-system_*.deb

# Copy with version in filename
DEB_FILENAME="obision-app-system_${NEW_VERSION}_all.deb"
cp builddir/obision-app-system.deb "$DEBS_DIR/$DEB_FILENAME"

echo "✅ .deb copied to $DEBS_DIR/$DEB_FILENAME"

# Update Packages and Release files in obision-packages
echo "📝 Updating Packages and Release files..."
cd "$PACKAGES_DIR"

# Generate Packages file
dpkg-scanpackages --multiversion debs > Packages
gzip -k -f Packages

# Generate Release file
cat > Release << EOF
Origin: Obision
Label: Obision Repository
Suite: stable
Codename: stable
Version: 1.0
Architectures: amd64
Components: main
Description: Obision applications repository
Date: $(date -Ru)
EOF

# Add checksums to Release
echo "MD5Sum:" >> Release
for file in Packages Packages.gz; do
    if [ -f "$file" ]; then
        echo " $(md5sum $file | cut -d' ' -f1) $(stat -c%s $file) $file" >> Release
    fi
done

echo "SHA1:" >> Release
for file in Packages Packages.gz; do
    if [ -f "$file" ]; then
        echo " $(sha1sum $file | cut -d' ' -f1) $(stat -c%s $file) $file" >> Release
    fi
done

echo "SHA256:" >> Release
for file in Packages Packages.gz; do
    if [ -f "$file" ]; then
        echo " $(sha256sum $file | cut -d' ' -f1) $(stat -c%s $file) $file" >> Release
    fi
done

echo "✅ Packages and Release files updated"

# Commit and push to obision-packages
echo "💾 Committing to obision-packages..."
git add "debs/$DEB_FILENAME" Packages Packages.gz Release
git commit -m "Add obision-app-system version $NEW_VERSION"
git push origin master

echo ""
echo "✅ Release $NEW_VERSION completed successfully!"
echo ""
echo "Summary:"
echo "  ✓ Version bumped to $NEW_VERSION"
echo "  ✓ Committed and tagged in obision-app-system"
echo "  ✓ .deb package built"
echo "  ✓ .deb copied to obision-packages"
echo "  ✓ Packages and Release files updated"
echo "  ✓ Changes pushed to obision-packages"
