;(function(){
$(function() {

    $(document).ready(function(){
        $('.scrollspy').scrollSpy();
    });

    $(document).ready(function(){
      $('.sidenav').sidenav({
        edge: 'right'
      });
    });

    $(document).ready(function(){
        $('.collapsible').collapsible();
    });

    // Scroll-triggered animations using Intersection Observer
    if ('IntersectionObserver' in window) {
        var animatedElements = document.querySelectorAll('.animate-on-scroll');
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                    observer.unobserve(entry.target);
                }
            });
        }, {threshold: 0.1});

        animatedElements.forEach(function(el) {
            observer.observe(el);
        });
    }

    // Back to top button
    var backToTop = document.getElementById('backToTop');
    if (backToTop) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 500) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        });
        backToTop.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({top: 0, behavior: 'smooth'});
        });
    }

});
})();
