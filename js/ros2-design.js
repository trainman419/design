var switch_to_closed = function() {
    $( 'li.open-pr' ).removeClass('active');
    $( 'li.closed-pr' ).addClass('active');
    $( 'div.open-pr-list' ).hide();
    $( 'div.closed-pr-list' ).show();
    $( 'li.open-pr' ).click(switch_to_open);
    $( 'li.closed-pr' ).unbind('click');
};

var switch_to_open = function() {
    $( 'li.closed-pr' ).removeClass('active');
    $( 'li.open-pr' ).addClass('active');
    $( 'div.closed-pr-list' ).hide();
    $( 'div.open-pr-list' ).show();
    $( 'li.open-pr' ).unbind('click');
    $( 'li.closed-pr' ).click(switch_to_closed);
};

$( document ).ready(function() {
    // Add table of contents title to toc generated from markdown pages
    $( 'div.maruku_toc' ).prepend('<p><strong>Table of Contents</strong></p>');
    // Add the bootstrap table class to table's inside of div's with table class
    $( 'div.table table' ).addClass('table').addClass('table-striped');
    // Set the default state to open pull requests being shown
    switch_to_open();
    // Set the redirect_uri for the login button
    sessionStorage.setItem('login_redirect', window.location);
    // If the github id is set, show us as logged in
    gh_token = localStorage.getItem('github_oauth_token');
    if (gh_token) {
        // Change login to logout
        $( 'a.login-btn' ).replaceWith([
            '<button class="login-btn btn btn-default navbar-btn">',
            '<span class="glyphicon glyphicon-user"></span> &nbsp;Logout',
            '</button>'].join('\n'));
        $( 'button.login-btn' ).click(function() {
            // When logout is clicked, unset github_oauth_token and refresh
            localStorage.removeItem('github_oauth_token');
            sessionStorage.removeItem('user_' + gh_token);
            window.location.reload();
        });
        github = new Github({token: gh_token});
        // Define function for updating logout button with user info
        var update_logout_btn = function(user) {
            // Update the logout button with user info
            $( 'button.login-btn' ).html(
                '<img class="gravatar" src="' + user.avatar_url + '"/> &nbsp;' + user.name + ', Logout');
        };
        // Check for an use if set the stored user info
        var stored_user = null;
        try {
            stored_user = JSON.parse(sessionStorage.getItem('user_' + gh_token));
        } catch (err) {}
        if (stored_user) {
            update_logout_btn(stored_user);
        } else {
            // Get user information from github
            user = github.getUser();
            user.show('', function(err, res) {
                // If there is an error
                if (err) {
                    // Show it
                    $( 'div.sidebar-container' ).append([
                        '<div class="panel panel-danger">',
                        '  <div class="panel-heading">',
                        '    <h3 class="panel-title">Error</h3>',
                        '  </div>',
                        '  <div class="panel-body">',
                        '    Error retrieving Github Info: ' + err,
                        '  </div>',
                        '</div>'].join('\n'));
                } else {
                    // Store user info for given gh_token
                    sessionStorage.setItem('user_' + gh_token, JSON.stringify(res));
                    update_logout_btn(res);
                }
            });
        }
        /* Get Pull Requests related to this page and populate accordingly */
        // Clear "please login" message
        $( 'div.pr-list' ).html('');
        // Determine the path to this file in github
        var this_file = window.location.pathname.substring(0, window.location.pathname.length - 1) + '.md';
        this_file = this_file.substring(1, this_file.length);
        // Keep track of the total number of open/closed pull requests about this file
        var total_open_pr = 0;
        var total_closed_pr = 0;
        // Define function for adding a pull request to the website
        var add_pull_request = function(pr, pr_files) {
            // Store the pr/files pair for later use
            sessionStorage.setItem('pr_' + pr['number'], JSON.stringify([pr, pr_files]));
            // Iterate over the list files affected by the pull request
            for (var i = 0; i < pr_files.length; i++) {
                // If the filename matches, update the page
                if (pr_files[i]['filename'] == this_file) {
                    // If open
                    if (pr['state'] == 'open') {
                        // Increment total open pr
                        total_open_pr = total_open_pr + 1;
                        // Update the open number badge
                        $( 'li.open-pr' ).html(
                            '<a>Open <span class="badge">' + total_open_pr + '</span></a>');
                        // Append a li with a link and title of the pull request
                        $( 'div.open-pr-list' ).append(
                            '<a href="' + pr['html_url'] +
                            '" class="list-group-item">' +
                            '<strong>#' + pr['number'] + '</strong> ' +
                            pr['title'] + '</a>');
                    }
                    // Else if closed
                    else if (pr['state'] == 'closed') {
                        // Increment total open pr
                        total_closed_pr = total_closed_pr + 1;
                        // Update the closed number badge
                        $( 'li.closed-pr' ).html(
                            '<a>Closed <span class="badge">' + total_closed_pr + '</span></a>');
                        // Append a li with a link and title of the pull request
                        $( 'div.closed-pr-list' ).append(
                            '<a href="' + pr['html_url'] +
                            '" class="list-group-item">' +
                            '<strong>#' + pr['number'] + '</strong> ' +
                            pr['title'] + '</a>');
                    }
                    // Else wtf
                    else {
                        console.log('Unknown state for pull request: ' + pr['state']);
                    }
                }
            }
        };
        // Define function for handling a single issue
        var check_issue = function(prs_in, index) {
            // If index >= the length of the issues originally given, exit
            if (index >= prs_in.length) {
                return;
            }
            // Else grab the current issue
            var pr = prs_in[index];
            // If not pr, wut?
            if (!pr) {
                console.log('pr is invalid');
                console.log(index);
                console.log(prs_in);
                console.log(pr);
                return check_issue(prs_in, index + 1);
            }
            // If we stored the pr previously and the sha of the head is the same, use its file listing
            var stored_pr_and_files = null;
            try {
                stored_pr_and_files = JSON.parse(sessionStorage.getItem('pr_' + pr['number']));
            } catch (err) {}
            if (stored_pr_and_files && stored_pr_and_files[0]['head']['sha'] == pr['head']['sha'])
            {
                add_pull_request(pr, stored_pr_and_files[1]);
            }
            // It is an unstored pr or one that has changed, so fetch it
            else {
                // Get the list of files for that pull request
                var api_url = 'https://api.github.com/repos/ros2/design/pulls/' + pr["number"] + '/files';
                // Add authentication, as not to hit our unauthenticated limit
                api_url += '?access_token=' + gh_token;
                // Make the call to github
                $.getJSON(api_url, function(data) {
                    add_pull_request(pr, data);
                });
            }
            // Recurse, until index >= prs_in.length
            check_issue(prs_in, index + 1);
        };
        // Fetch open and closed pull requests, passing the first of each to check_issue
        var issues = github.getIssues('ros2', 'design');
        // open
        issues.list_pr({state: 'open'}, function(err, prs) {
            check_issue(prs, 0);
        });
        // closed
        issues.list_pr({state: 'closed'}, function(err, prs) {
            check_issue(prs, 0);
        });
    }
});